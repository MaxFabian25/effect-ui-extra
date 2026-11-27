import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const tmpBase = mkdtempSync(join(tmpdir(), "effect-ui-extra-consumer-"))

const run = (cmd: ReadonlyArray<string>, cwd: string) => {
  const proc = Bun.spawnSync([...cmd], {
    cwd,
    stdout: "pipe",
    stderr: "pipe"
  })
  if (proc.exitCode !== 0) {
    throw new Error(
      `Command failed (${cmd.join(" ")}):\n${proc.stdout.toString()}\n${proc.stderr.toString()}`
    )
  }
  return proc.stdout.toString()
}

try {
  // Verify BOTH git-install mode (source-first exports) and published dist mode
  for (const mode of ["git-source", "published-dist"] as const) {
    const dir = join(tmpBase, mode)
    const nm = join(dir, "node_modules")
    const pkgDir = join(nm, "effect-ui-extra")
    mkdirSync(pkgDir, { recursive: true })

    // Share peer/dev deps from repo node_modules so no network access is needed
    for (const dep of ["effect", "@effect", "typescript", "@types", "happy-dom"]) {
      const src = resolve(ROOT, "node_modules", dep)
      if (existsSync(src)) {
        symlinkSync(src, join(nm, dep))
      }
    }

    const rawPkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as {
      exports: unknown
      publishConfig?: { exports?: unknown }
      [key: string]: unknown
    }

    if (mode === "git-source") {
      // Simulate github: install where dist/ is absent
      cpSync(resolve(ROOT, "src"), join(pkgDir, "src"), { recursive: true })
      cpSync(resolve(ROOT, "styles"), join(pkgDir, "styles"), { recursive: true })
      writeFileSync(join(pkgDir, "package.json"), JSON.stringify(rawPkg, null, 2))
    } else {
      // Simulate npm publish where publishConfig.exports replaces exports and only dist/ + styles/ ship
      if (!existsSync(resolve(ROOT, "dist/index.js"))) {
        throw new Error("dist/ is missing. Run 'bun run build' before check:consumer.")
      }
      cpSync(resolve(ROOT, "dist"), join(pkgDir, "dist"), { recursive: true })
      cpSync(resolve(ROOT, "styles"), join(pkgDir, "styles"), { recursive: true })
      const publishedPkg = {
        ...rawPkg,
        exports: rawPkg.publishConfig?.exports ?? rawPkg.exports
      }
      writeFileSync(join(pkgDir, "package.json"), JSON.stringify(publishedPkg, null, 2))
    }

    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "consumer-smoke", type: "module" }, null, 2)
    )
    writeFileSync(
      join(dir, "tsconfig.json"),
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
          include: ["smoke.ts"]
        },
        null,
        2
      )
    )

    writeFileSync(
      join(dir, "smoke.ts"),
      `import { readFileSync } from "node:fs"
import * as Root from "effect-ui-extra"
import { auditAccessibleNames, checkPattern } from "effect-ui-extra/a11y"
import { checkServer, cspLayer, preferencesScript, reduceIosTouchGuard } from "effect-ui-extra/page"
import { buildPaginationRange, Carousel, ColorPicker, ImageCropper, TimeInput, Timeline, Waterfall } from "effect-ui-extra/widgets"
import { computeAutoScroll, moveGridFocus, transferItem } from "effect-ui-extra/direct"
import { auditThemeContrast, DEFAULT_LIGHT_TOKENS, themeContrastPairs } from "effect-ui-extra/theme"
import { reduceCarousel, reduceScrollHandoff, solveSpring, springLinearEasing } from "effect-ui-extra/motion"
import { generatePresetCss, listVisualPresets, REGISTRY_ITEMS, runCli } from "effect-ui-extra/registry"

const cssPath = Bun.resolveSync("effect-ui-extra/theme/effect-ui.css", import.meta.dir)
const css = readFileSync(cssPath, "utf8")
if (!css.includes("@layer effect-ui")) throw new Error("CSS layer missing")

if (typeof Root.A11y.checkPattern !== "function") throw new Error("Root.A11y missing")
if (typeof Root.Registry.runCli !== "function") throw new Error("Root.Registry missing")
if (typeof checkPattern !== "function" || typeof auditAccessibleNames !== "function") throw new Error("a11y missing")
if (typeof checkServer !== "function" || typeof preferencesScript !== "function" || typeof cspLayer !== "function" || typeof reduceIosTouchGuard !== "function") throw new Error("page missing")
if (typeof TimeInput !== "function" || typeof ColorPicker !== "function" || typeof Carousel !== "function" || typeof ImageCropper !== "function" || typeof Timeline !== "function" || typeof Waterfall !== "function") throw new Error("widgets missing")
if (buildPaginationRange({ page: 5, totalPages: 10 }).length === 0) throw new Error("pagination failed")
if (typeof moveGridFocus !== "function" || typeof computeAutoScroll !== "function" || typeof transferItem !== "function") throw new Error("direct missing")
if (auditThemeContrast(themeContrastPairs(DEFAULT_LIGHT_TOKENS)).length !== 0) throw new Error("theme contrast failed")
if (!springLinearEasing().easing.startsWith("linear(")) throw new Error("motion easing failed")
if (solveSpring(0, 0, 1).position !== 0 || typeof reduceCarousel !== "function" || typeof reduceScrollHandoff !== "function") throw new Error("motion failed")
if (REGISTRY_ITEMS.length < 27 || listVisualPresets().length !== 5 || !generatePresetCss("nova").includes("@theme inline") || runCli(["--help"], ".").exitCode !== 0) throw new Error("registry failed")

console.log("CONSUMER_OK:${mode}")
`
    )

    run([resolve(ROOT, "node_modules/.bin/tsc"), "--noEmit"], dir)
    const out = run(["bun", "smoke.ts"], dir).trim()
    console.log(out)
  }
} finally {
  rmSync(tmpBase, { recursive: true, force: true })
}
