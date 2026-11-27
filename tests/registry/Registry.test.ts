import { HtmlLocator, HtmlPlay } from "@effect/ui/html/testing"
import { TestHost } from "@effect/ui/testing"
import { describe, expect, it } from "bun:test"
import { Effect, Layer } from "effect"
import { TestClock } from "effect/testing"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { A11yFocus, checkAccessibleNames } from "../../src/a11y/index.js"
import { checkServer } from "../../src/page/index.js"
import {
  generatePresetCss,
  listRegistryItems,
  listVisualPresets,
  REGISTRY_ITEMS,
  resolveRegistryTree,
  runAdd,
  runCli,
  runDiff,
  runInit,
  runPreset
} from "../../src/registry/index.js"
import { auditThemeContrast, themeContrastPairs } from "../../src/theme/index.js"

const ROOT = resolve(import.meta.dir, "../..")

const playLayer = Layer.mergeAll(
  TestHost.layer(),
  A11yFocus.layer(),
  TestClock.layer()
)

const runPlay = <A, E>(eff: Effect.Effect<A, E, any>) =>
  Effect.runPromise(eff.pipe(Effect.provide(playLayer)) as Effect.Effect<A, E, never>)

describe("Visual presets WCAG 2.1 AA audit", () => {
  it("audits all 5 visual presets (light and dark) with zero contrast failures", () => {
    const presets = listVisualPresets()
    expect(presets.length).toBe(5)

    for (const preset of presets) {
      const lightFailures = auditThemeContrast(themeContrastPairs(preset.light))
      const darkFailures = auditThemeContrast(themeContrastPairs(preset.dark))
      expect({ preset: preset.name, lightFailures, darkFailures }).toEqual({
        preset: preset.name,
        lightFailures: [],
        darkFailures: []
      })

      const css = generatePresetCss(preset.name)
      expect(css).toContain("@layer effect-ui")
      expect(css).toContain("@theme inline")
      expect(css).toContain("--color-chart-1: var(--eui-chart-1);")
    }
  })
})

describe("Registry catalog and CLI workflow", () => {
  it("resolves transitive registry dependencies cleanly and supports init, add, preset, diff, list, view", () => {
    const plan = resolveRegistryTree(["block-dashboard", "block-ai-chat"])
    expect(plan.missing).toEqual([])
    const names = plan.items.map((i) => i.name)
    expect(names.indexOf("cn")).toBeLessThan(names.indexOf("sidebar"))
    expect(names.indexOf("sidebar")).toBeLessThan(names.indexOf("block-dashboard"))
    expect(names.indexOf("code-block")).toBeLessThan(names.indexOf("block-ai-chat"))
    expect(listRegistryItems({ category: "ai" }).length).toBe(6)
    expect(listRegistryItems({ category: "blocks" }).length).toBe(3)

    const tmp = mkdtempSync(join(tmpdir(), "effect-ui-cli-"))
    try {
      const initRes = runInit(tmp, { preset: "mira", dir: "src/ui" })
      expect(initRes.preset).toBe("mira")
      expect(existsSync(join(tmp, "effect-ui.json"))).toBe(true)
      expect(existsSync(join(tmp, "src/ui/theme.css"))).toBe(true)
      expect(existsSync(join(tmp, "src/ui/cn.ts"))).toBe(true)

      const addRes = runAdd(tmp, ["button", "sidebar"])
      expect(addRes.missing).toEqual([])
      expect(addRes.addedItems).toEqual(["cn", "button", "kbd", "sidebar"])
      expect(addRes.skippedFiles).toContain("src/ui/cn.ts")

      // Clean diff right after add
      expect(runDiff(tmp).every((d) => d.status === "same")).toBe(true)

      // Mutate local button.ts and verify diff catches it
      const btnPath = join(tmp, "src/ui/button.ts")
      writeFileSync(btnPath, `${readFileSync(btnPath, "utf8")}\n// local tweak\n`, "utf8")
      const diffs = runDiff(tmp, ["button"])
      expect(diffs.some((d) => d.status === "modified" && d.path === "src/ui/button.ts")).toBe(true)

      // Preset switch updates theme.css
      const pRes = runPreset(tmp, "lyra")
      expect(pRes.preset).toBe("lyra")
      expect(readFileSync(join(tmp, "src/ui/theme.css"), "utf8")).toContain("preset: lyra")

      // CLI entrypoints
      expect(runCli(["list", "--category", "ai"], tmp).exitCode).toBe(0)
      expect(runCli(["view", "data-table"], tmp).exitCode).toBe(0)
      expect(runCli(["add", "does-not-exist"], tmp).exitCode).toBe(1)
      expect(runCli(["preset", "list"], tmp).exitCode).toBe(0)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it("compiles all 27 materialized blueprints under strict TypeScript and passes live HtmlPlay + SSR checks", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "effect-ui-compile-"))
    try {
      runInit(tmp, { preset: "nova", dir: "src/ui" })
      const allNames = REGISTRY_ITEMS.map((i) => i.name)
      const added = runAdd(tmp, allNames, { overwrite: true })
      expect(added.missing).toEqual([])
      expect(added.addedItems.length).toBe(REGISTRY_ITEMS.length)

      // Wire node_modules symlinks so tsc checks against real Effect + Effect UI + effect-ui-extra
      const nm = join(tmp, "node_modules")
      mkdirSync(nm, { recursive: true })
      for (const dep of ["effect", "@effect", "typescript", "@types"]) {
        const src = resolve(ROOT, "node_modules", dep)
        if (existsSync(src)) symlinkSync(src, join(nm, dep))
      }
      symlinkSync(ROOT, join(nm, "effect-ui-extra"))

      writeFileSync(
        join(tmp, "package.json"),
        JSON.stringify({ name: "registry-compile-smoke", type: "module" }, null, 2)
      )
      writeFileSync(
        join(tmp, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
              lib: ["ES2022", "DOM"],
              strict: true,
              exactOptionalPropertyTypes: true,
              noUncheckedIndexedAccess: true,
              skipLibCheck: true,
              noEmit: true
            },
            include: ["src/ui/**/*.ts"]
          },
          null,
          2
        )
      )

      const tsc = Bun.spawnSync([resolve(ROOT, "node_modules/.bin/tsc"), "--noEmit"], {
        cwd: tmp,
        stdout: "pipe",
        stderr: "pipe"
      })
      if (tsc.exitCode !== 0) {
        throw new Error(
          `Materialized registry failed strict tsc:\n${tsc.stdout.toString()}\n${tsc.stderr.toString()}`
        )
      }

      // Live behavioral & SSR checks on materialized components
      const { DataTable } = await import(join(tmp, "src/ui/dataTable.ts"))
      const { Questionnaire } = await import(join(tmp, "src/ui/questionnaire.ts"))
      const { DashboardBlock } = await import(join(tmp, "src/ui/blocks/dashboard.ts"))
      const { AuthBlock } = await import(join(tmp, "src/ui/blocks/auth.ts"))
      const { AiChatBlock } = await import(join(tmp, "src/ui/blocks/aiChat.ts"))

      await runPlay(
        Effect.gen(function*() {
          yield* checkServer(DashboardBlock, {})
          yield* checkServer(AuthBlock, {})
          yield* checkServer(AiChatBlock, {})

          // Interactive DataTable sort + filter + selection
          yield* Effect.scoped(
            Effect.gen(function*() {
              const play = yield* HtmlPlay.make(DataTable, {
                label: "Invoices",
                selectable: true,
                columns: [
                  { key: "id", header: "ID" },
                  { key: "customer", header: "Customer" }
                ],
                rows: [
                  { id: "1", cells: { id: "INV-2", customer: "Beta" } },
                  { id: "2", cells: { id: "INV-1", customer: "Alpha" } }
                ]
              })
              yield* checkAccessibleNames(play)
              const sortBtn = HtmlLocator.role("button", { name: "Customer" })
              yield* play.click(sortBtn)
              const selectRow = HtmlLocator.role("checkbox", { name: "Select row 1" })
              yield* play.click(selectRow)
            })
          )

          // Interactive Questionnaire validation + step progression
          yield* Effect.scoped(
            Effect.gen(function*() {
              const play = yield* HtmlPlay.make(Questionnaire, {
                label: "Setup",
                questions: [
                  {
                    id: "q1",
                    title: "Pick preset",
                    choices: [
                      { id: "nova", label: "Nova" },
                      { id: "mira", label: "Mira" }
                    ]
                  }
                ]
              })
              yield* checkAccessibleNames(play)
              const submit = HtmlLocator.role("button", { name: "Submit" })
              yield* play.click(submit)
              yield* play.expect(HtmlLocator.role("alert")).toHaveText("Select an option to continue.")
              yield* play.click(HtmlLocator.role("radio", { name: "Nova" }))
              yield* play.click(submit)
            })
          )
        })
      )
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  }, 30_000)
})
