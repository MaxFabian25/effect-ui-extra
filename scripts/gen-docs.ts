import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { Schema } from "effect"

const ROOT = resolve(import.meta.dir, "..")
const PackageJsonSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  description: Schema.String,
  exports: Schema.Record(Schema.String, Schema.Unknown)
})
const pkg = Schema.decodeUnknownSync(PackageJsonSchema)(
  JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"))
)

interface SubpathSpec {
  readonly subpath: string
  readonly entry: string
  readonly summary: string
}

const SUBPATHS: ReadonlyArray<SubpathSpec> = [
  {
    subpath: "effect-ui-extra/a11y",
    entry: "src/a11y/index.ts",
    summary:
      "15 WAI-ARIA APG pattern verifiers, LTR/RTL direction checks, accessible-name checks, checkMarkup DOM-integrity auditor, and zero-DOM TestHost focus tracking."
  },
  {
    subpath: "effect-ui-extra/page",
    entry: "src/page/index.ts",
    summary:
      "Zero-FOUC SSR preferences and color scheme, CspContext nonce helpers, iOS modal touch jitter guard, Deferred-backed overlays, LiveAnnouncer, scoped ShortcutRegistry, checkServer SSR purity guard, semantic PageObserver/PageHistory with undoAgent(), transactional history staging and observe marks, InputModalityTracker, hidden=\"until-found\" helpers, theme-color dimming, DOM tabbable walker, and Form validationMode + server-error focus helper."
  },
  {
    subpath: "effect-ui-extra/widgets",
    entry: "src/widgets/index.ts",
    summary:
      "Headless application widgets and AI-chat controls complementing @effect/ui-kit (Command, Tree, Resizable, Listbox, PasswordInput, TimeInput, DateTimePicker, TokenInput, Pagination, SegmentedControl, InlineEdit, Rating, ColorPicker, AreaPicker, ScrollPicker, Carousel, ImageCropper, Timeline, Waterfall, StickToBottom, TriggerMenu, InputHistory, inputHints, TreeChecked, AsyncOptions, structured prompt tokens)."
  },
  {
    subpath: "effect-ui-extra/direct",
    entry: "src/direct/index.ts",
    summary:
      "Pure 2D spatial/grid focus, CellRange and lasso selection, SwipeActions, TestClock-driven holdEffect/repeatStream, cycle-safe TreeReorder, cross-container Kanban transfer, infinite canvas Viewport/Connect, quadratic edge AutoScroll, TimeSpan math, NumberScale (log/custom + locale parsing), draftMove controller, 2D VirtualGrid math, CLDR firstDayOfWeek + PlainDate helpers, 2D move/8-handle resize/dragPreview, and textEditor caret-preserving helpers."
  },
  {
    subpath: "effect-ui-extra/theme",
    entry: "src/theme/index.ts",
    summary:
      "OKLCH/sRGB/Display-P3 color engine, hue-preserving gamut clamping, WCAG 2.1 and APCA contrast auditing, deltaEOK perceptual distance, 148 CSS named colors, theme CSS generation, and opt-in @layer effect-ui stylesheet (effect-ui-extra/theme/effect-ui.css)."
  },
  {
    subpath: "effect-ui-extra/motion",
    entry: "src/motion/index.ts",
    summary:
      "Closed-form analytical springs, compositor CSS linear() easing, pointer velocity tracker, momentum projection, rubber-band overscroll, snap points, draggable sheet reducer, scroll-to-drag handoff, radial sectorOf math, popup safePolygon corridor geometry, Presence lifecycle, and Carousel reducer."
  },
  {
    subpath: "effect-ui-extra/registry",
    entry: "src/registry/index.ts",
    summary:
      "shadcn-style copy-paste styled component registry with 82 wired items (64/64 shadcn base/ui wired blueprints, 6 interactive SVG charts, 9 page blocks, cn, dialog-card, data-table), 8 WCAG-audited OKLCH styles plus composable v1 preset codes, icon-pack switching, namespaced @org/item local/HTTPS registry consumption, custom registry validate/build, 8-tool JSON-RPC 2.0 effect-ui mcp server, and effect-ui CLI (init, list, search, view, docs, info, add, apply, diff, preset, icon-pack, registry, mcp)."
  }
]

interface ExtractedExport {
  readonly name: string
  readonly kind: "type" | "value"
}

const extractExports = (entryRel: string): ReadonlyArray<ExtractedExport> => {
  const entryPath = resolve(ROOT, entryRel)
  const sourceText = readFileSync(entryPath, "utf8")
  const stripped = sourceText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
  const items: Array<ExtractedExport> = []
  const exportBlockPattern = /\bexport\s+(type\s+)?\{([^}]*)\}\s*(?:from\s*["'][^"']+["'])?/g

  for (const match of stripped.matchAll(exportBlockPattern)) {
    const blockIsTypeOnly = match[1] !== undefined
    const body = match[2] ?? ""
    for (const rawEntry of body.split(",")) {
      const trimmed = rawEntry.trim()
      if (trimmed.length === 0) continue
      const isTypeSpec = trimmed.startsWith("type ")
      const withoutType = isTypeSpec ? trimmed.slice(5).trim() : trimmed
      const aliasParts = withoutType.split(/\s+as\s+/)
      const exportedName = (aliasParts[1] ?? aliasParts[0] ?? "").trim()
      if (exportedName.length === 0) continue
      items.push({
        name: exportedName,
        kind: blockIsTypeOnly || isTypeSpec ? "type" : "value"
      })
    }
  }
  return items
}

const renderLlmsTxt = (): string => {
  const lines: Array<string> = [
    `# ${pkg.name} v${pkg.version}`,
    "",
    `> ${pkg.description}`,
    "",
    "Install pinned to a commit SHA: `github:MaxFabian25/effect-ui-extra#<sha>`.",
    "Import by subpath so bundlers tree-shake unused modules.",
    "",
    "## Subpath Exports",
    ""
  ]

  for (const spec of SUBPATHS) {
    const exports = extractExports(spec.entry)
    const values = exports.filter((e) => e.kind === "value").map((e) => `\`${e.name}\``)
    const types = exports.filter((e) => e.kind === "type").map((e) => `\`${e.name}\``)

    lines.push(`### \`${spec.subpath}\``)
    lines.push("")
    lines.push(spec.summary)
    lines.push("")
    lines.push(`- **Values (${values.length}):** ${values.join(", ")}`)
    if (types.length > 0) {
      lines.push(`- **Types (${types.length}):** ${types.join(", ")}`)
    }
    lines.push("")
  }

  lines.push("### `effect-ui-extra/theme/effect-ui.css`")
  lines.push("")
  lines.push(
    "Optional `@layer effect-ui` default stylesheet with native `light-dark()` OKLCH tokens, `[data-color-scheme=\"light\"|\"dark\"]` overrides for `effect-ui-extra/page`, `prefers-reduced-motion`, `forced-colors`, and zero CSS `content:` icon hacks."
  )
  lines.push("")
  lines.push("### `effect-ui-extra` (root namespace export)")
  lines.push("")
  lines.push("Re-exports `A11y`, `Direct`, `Motion`, `Page`, `Registry`, `Theme`, and `Widgets` namespaces.")
  lines.push("")

  return lines.join("\n")
}

const renderAgentsMd = (): string => {
  const counts = SUBPATHS.map((s) => {
    const ex = extractExports(s.entry)
    return `| \`${s.subpath}\` | ${ex.filter((e) => e.kind === "value").length} values, ${ex.filter((e) => e.kind === "type").length} types | ${s.summary} |`
  })

  return `# ${pkg.name} (AGENTS.md)

Version: \`${pkg.version}\` (generated from \`src/\` via \`bun run gen:docs\`; read \`llms.txt\` in this package for the full symbol index).

## Rules for agents using this package

1. **Import by subpath.** Prefer \`effect-ui-extra/widgets\`, \`effect-ui-extra/page\`, \`effect-ui-extra/a11y\`, \`effect-ui-extra/direct\`, \`effect-ui-extra/theme\`, \`effect-ui-extra/theme/effect-ui.css\`, and \`effect-ui-extra/motion\` over the root barrel so unused modules stay out of client bundles.
2. **Pair zero-FOUC theme persistence with the layered stylesheet.** Inline \`preferencesScript()\` from \`effect-ui-extra/page\` in SSR \`<head>\` and import \`effect-ui-extra/theme/effect-ui.css\`; both coordinate on \`:root[data-color-scheme="light"|"dark"]\`.
3. **Run all four built-in audits in UI tests.** Under \`bun test\` with \`TestHost.layer()\`, \`A11yFocus.layer\`, and \`TestClock.layer()\`:
   - \`checkPattern(play, pattern)\` and \`checkDirection(...)\` from \`effect-ui-extra/a11y\`
   - \`checkAccessibleNames(play)\` from \`effect-ui-extra/a11y\`
   - \`checkServer(Component, props)\` from \`effect-ui-extra/page\`
   - \`auditThemeContrast(themeContrastPairs(tokens))\` from \`effect-ui-extra/theme\`
4. **Keep secrets redacted.** Use \`PasswordInput\` (\`Schema.Redacted\`) and \`PageObserver\`/\`PageHistory\` redaction so secrets never serialize into SSR state or undo logs.
5. **Respect Effect 4 conventions.** \`Stream.runCollect\` returns \`Array<A>\` directly, \`Queue.offerUnsafe(queue, value)\` is a module function, and forked test fibers that must register before \`TestHost.settle\` need \`{ startImmediately: true }\`.

## Subpath reference

| Import path | Exports | Covers |
| --- | --- | --- |
${counts.join("\n")}
| \`effect-ui-extra/theme/effect-ui.css\` | CSS layer | Opt-in \`@layer effect-ui\` tokens and control styles |
`
}

const checkMode = process.argv.includes("--check")
const targets: ReadonlyArray<{ readonly path: string; readonly content: string }> = [
  { path: resolve(ROOT, "llms.txt"), content: renderLlmsTxt() },
  { path: resolve(ROOT, "AGENTS.md"), content: renderAgentsMd() }
]

let stale = false
for (const target of targets) {
  let existing = ""
  try {
    existing = readFileSync(target.path, "utf8")
  } catch {
    existing = ""
  }
  if (checkMode) {
    if (existing !== target.content) {
      console.error(`STALE DOC: ${target.path} is out of sync with src/. Run 'bun run gen:docs'.`)
      stale = true
    }
  } else {
    writeFileSync(target.path, target.content, "utf8")
    console.log(`wrote ${target.path} (${Buffer.byteLength(target.content)} bytes)`)
  }
}

if (checkMode && stale) {
  process.exit(1)
}
if (checkMode) {
  console.log("docs check passed: AGENTS.md and llms.txt match src/")
}
