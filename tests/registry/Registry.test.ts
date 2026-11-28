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
  buildCustomRegistry,
  generateIconModule,
  generatePresetCss,
  handleMcpLine,
  handleMcpRequest,
  listRegistryItems,
  listVisualPresets,
  MCP_TOOL_DEFINITIONS,
  REGISTRY_ITEMS,
  resolveRegistryTree,
  runAdd,
  runCli,
  runDiff,
  runIconPack,
  runInit,
  runPreset,
  validateCustomRegistry
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
    expect(listRegistryItems({ category: "ai" }).length).toBe(8)
    expect(listRegistryItems({ category: "blocks" }).length).toBe(3)
    expect(REGISTRY_ITEMS.length).toBe(70)

    const tmp = mkdtempSync(join(tmpdir(), "effect-ui-cli-"))
    try {
      const initRes = runInit(tmp, { preset: "mira", dir: "src/ui", iconPack: "lucide" })
      expect(initRes.preset).toBe("mira")
      expect(initRes.iconPack).toBe("lucide")
      expect(existsSync(join(tmp, "effect-ui.json"))).toBe(true)
      expect(existsSync(join(tmp, "src/ui/theme.css"))).toBe(true)
      expect(existsSync(join(tmp, "src/ui/icons.ts"))).toBe(true)
      expect(existsSync(join(tmp, "src/ui/cn.ts"))).toBe(true)
      expect(readFileSync(join(tmp, "src/ui/icons.ts"), "utf8")).toContain("lucide:chevron-down")

      // Switch icon pack to tabler
      const iconSwitch = runIconPack(tmp, "tabler")
      expect(iconSwitch.iconPack).toBe("tabler")
      expect(readFileSync(join(tmp, "src/ui/icons.ts"), "utf8")).toContain("tabler:chevron-down")
      expect(generateIconModule("inline-svg")).toContain('ICON_PACK = "inline-svg"')

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

  it("compiles all 70 materialized blueprints and icons.ts under strict TypeScript and passes live HtmlPlay + SSR checks", async () => {
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
  }, 45_000)

  it("validates and builds custom registries via API and CLI", () => {
    const tmp = mkdtempSync(join(tmpdir(), "effect-ui-custom-reg-"))
    try {
      const validManifest = {
        name: "acme-ui",
        homepage: "https://acme.example",
        items: [
          {
            name: "acme-banner",
            title: "Acme Banner",
            category: "primitives",
            description: "Company announcement banner.",
            registryDependencies: ["cn"],
            dependencies: ["@effect/ui"],
            files: [{ path: "acmeBanner.ts", content: "export const banner = 'ok'\n" }]
          }
        ]
      }
      const manifestPath = join(tmp, "registry.json")
      writeFileSync(manifestPath, JSON.stringify(validManifest, null, 2), "utf8")

      const validRes = validateCustomRegistry(tmp)
      expect(validRes.valid).toBe(true)
      expect(validRes.errors).toEqual([])

      const outDir = join(tmp, "dist/registry")
      const built = buildCustomRegistry(tmp, outDir)
      expect(built.ok).toBe(true)
      expect(built.itemCount).toBe(1)
      expect(existsSync(join(outDir, "index.json"))).toBe(true)
      expect(existsSync(join(outDir, "items/acme-banner.json"))).toBe(true)

      expect(runCli(["registry", "validate"], tmp).exitCode).toBe(0)
      expect(runCli(["registry", "build", "--out", "built"], tmp).exitCode).toBe(0)
      expect(runCli(["icon-pack", "lucide"], tmp).exitCode).toBe(0)

      // Path traversal and missing dependency fail validation
      const badPath = join(tmp, "bad.json")
      writeFileSync(
        badPath,
        JSON.stringify({
          name: "bad-reg",
          items: [
            {
              name: "escape",
              title: "Escape",
              category: "primitives",
              description: "Bad path",
              registryDependencies: ["nonexistent-item"],
              dependencies: [],
              files: [{ path: "../evil.ts", content: "export const x = 1" }]
            }
          ]
        }),
        "utf8"
      )
      const invalid = validateCustomRegistry(badPath)
      expect(invalid.valid).toBe(false)
      expect(invalid.errors.some((e) => e.includes("unsafe file path"))).toBe(true)
      expect(invalid.errors.some((e) => e.includes("nonexistent-item"))).toBe(true)
      expect(runCli(["registry", "validate", "bad.json"], tmp).exitCode).toBe(1)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it("serves JSON-RPC 2.0 MCP tools for registry discovery, add commands, presets, and audit checklist", () => {
    const init = handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "initialize" })
    expect(init?.error).toBeUndefined()
    expect((init?.result as { serverInfo: { name: string } }).serverInfo.name).toBe("effect-ui-registry")

    expect(handleMcpRequest({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull()
    expect(handleMcpRequest({ jsonrpc: "2.0", id: 2, method: "ping" })?.result).toEqual({})

    const tools = handleMcpRequest({ jsonrpc: "2.0", id: 3, method: "tools/list" })
    expect((tools?.result as { tools: ReadonlyArray<unknown> }).tools.length).toBe(MCP_TOOL_DEFINITIONS.length)

    const listCall = handleMcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "list_items", arguments: { category: "blocks" } }
    })
    const listText = (listCall?.result as { content: ReadonlyArray<{ text: string }> }).content[0]!.text
    expect(JSON.parse(listText).count).toBe(3)

    const searchCall = handleMcpRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "search_items", arguments: { query: "accordion" } }
    })
    expect((searchCall?.result as { content: ReadonlyArray<{ text: string }> }).content[0]!.text).toContain("accordion")

    const viewCall = handleMcpRequest({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "view_items", arguments: { names: ["dialog", "bubble"] } }
    })
    const viewPayload = JSON.parse((viewCall?.result as { content: ReadonlyArray<{ text: string }> }).content[0]!.text)
    expect(viewPayload.items.length).toBe(2)

    const addCall = handleMcpRequest({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "get_add_command", arguments: { names: ["block-dashboard"] } }
    })
    const addPayload = JSON.parse((addCall?.result as { content: ReadonlyArray<{ text: string }> }).content[0]!.text)
    expect(addPayload.command).toBe("bunx effect-ui add block-dashboard")
    expect(addPayload.resolvedItems).toContain("sidebar")

    const presetsCall = handleMcpRequest({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "list_presets", arguments: {} }
    })
    expect(JSON.parse((presetsCall?.result as { content: ReadonlyArray<{ text: string }> }).content[0]!.text).presets.length).toBe(5)

    const auditCall = handleMcpRequest({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "get_audit_checklist", arguments: {} }
    })
    expect(JSON.parse((auditCall?.result as { content: ReadonlyArray<{ text: string }> }).content[0]!.text).gates.length).toBe(4)

    // Parse error and unknown method
    expect(JSON.parse(handleMcpLine("{not-json")!).error.code).toBe(-32700)
    expect(handleMcpRequest({ jsonrpc: "2.0", id: 10, method: "nope" })?.error?.code).toBe(-32601)
  })
})
