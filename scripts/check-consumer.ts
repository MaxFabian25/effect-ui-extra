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
import { auditAccessibleNames, auditMarkup, checkPattern } from "effect-ui-extra/a11y"
import { checkServer, createHistoryStage, createMarkRegistry, cspLayer, getTabbables, preferencesScript, reduceFormValidation, reduceIosTouchGuard } from "effect-ui-extra/page"
import { AreaPicker, buildPaginationRange, Carousel, ColorPicker, DateTimePicker, ImageCropper, ScrollPicker, TimeInput, Timeline, Waterfall } from "effect-ui-extra/widgets"
import { computeAutoScroll, computeVirtualGrid, firstDayOfWeek, moveGridFocus, replaceTextRange, stepMove2D, stepResizeBox, transferItem, valueToRatio } from "effect-ui-extra/direct"
import { auditThemeContrast, DEFAULT_LIGHT_TOKENS, deltaEOK, resolveCssNamedColor, themeContrastPairs } from "effect-ui-extra/theme"
import { isPointInSafePolygon, reduceCarousel, reduceScrollHandoff, sectorOf, solveSpring, springLinearEasing } from "effect-ui-extra/motion"
import { decodePresetCode, encodePresetCode, generateIconModule, generatePresetCss, handleMcpRequest, listVisualPresets, parseNamespacedItem, REGISTRY_ITEMS, runCli, validateCustomRegistry } from "effect-ui-extra/registry"

const cssPath = Bun.resolveSync("effect-ui-extra/theme/effect-ui.css", import.meta.dir)
const css = readFileSync(cssPath, "utf8")
if (!css.includes("@layer effect-ui")) throw new Error("CSS layer missing")

if (typeof Root.A11y.checkPattern !== "function") throw new Error("Root.A11y missing")
if (typeof Root.Registry.runCli !== "function") throw new Error("Root.Registry missing")
if (typeof checkPattern !== "function" || typeof auditAccessibleNames !== "function" || auditMarkup("<div id='a'></div>").length !== 0) throw new Error("a11y missing")
if (typeof checkServer !== "function" || typeof preferencesScript !== "function" || typeof cspLayer !== "function" || typeof reduceIosTouchGuard !== "function" || typeof getTabbables !== "function" || typeof reduceFormValidation !== "function" || typeof createHistoryStage !== "function" || typeof createMarkRegistry !== "function") throw new Error("page missing")
if (typeof TimeInput !== "function" || typeof ColorPicker !== "function" || typeof Carousel !== "function" || typeof ImageCropper !== "function" || typeof Timeline !== "function" || typeof Waterfall !== "function" || typeof AreaPicker !== "function" || typeof ScrollPicker !== "function" || typeof DateTimePicker !== "function") throw new Error("widgets missing")
if (buildPaginationRange({ page: 5, totalPages: 10 }).length === 0) throw new Error("pagination failed")
if (typeof moveGridFocus !== "function" || typeof computeAutoScroll !== "function" || typeof transferItem !== "function" || firstDayOfWeek("da-DK") !== 1 || computeVirtualGrid({ rowCount: 10, columnCount: 4, rowHeight: 40, columnWidth: 100 }, { scrollTop: 0, scrollLeft: 0, height: 200, width: 400 }).cells.length === 0 || valueToRatio(10, 1, 100, "log") <= 0 || stepMove2D({ x: 0, y: 0, width: 10, height: 10 }, 5, 0).x !== 5 || stepResizeBox({ x: 0, y: 0, width: 20, height: 20 }, "se", 10, 10).width !== 30 || replaceTextRange("ab", 1, 2, "c").value !== "ac") throw new Error("direct missing")
if (auditThemeContrast(themeContrastPairs(DEFAULT_LIGHT_TOKENS)).length !== 0 || resolveCssNamedColor("rebeccapurple") === undefined || deltaEOK("#663399", "rebeccapurple") !== 0) throw new Error("theme failed")
if (!springLinearEasing().easing.startsWith("linear(")) throw new Error("motion easing failed")
if (solveSpring(0, 0, 1).position !== 0 || typeof reduceCarousel !== "function" || typeof reduceScrollHandoff !== "function" || sectorOf(40, 0, 4) !== 1 || !isPointInSafePolygon({ x: 150, y: 120 }, { x: 100, y: 100 }, { left: 200, top: 40, right: 300, bottom: 200 })) throw new Error("motion failed")
if (REGISTRY_ITEMS.length < 82 || listVisualPresets().length !== 8 || decodePresetCode(encodePresetCode({ style: "luma", baseColor: "slate", accent: "blue", radius: "md" })).style !== "luma" || parseNamespacedItem("@acme/banner")?.namespace !== "@acme" || !generatePresetCss("luma").includes("@theme inline") || !generateIconModule("lucide").includes("lucide:check") || runCli(["--help"], ".").exitCode !== 0 || typeof validateCustomRegistry !== "function" || handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "ping" })?.error !== undefined) throw new Error("registry failed")

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
