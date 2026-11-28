# effect-ui-extra

Unified, tree-shakeable companion toolkit for `@effect/ui` and `@effect/ui-kit` on Bun and Effect 4. One package, one SHA pin, zero upstream fork rebase debt.

## Subpath exports

Install pinned to a commit SHA (`github:MaxFabian25/effect-ui-extra#<sha>`) and import only the subpaths you use:

- **`effect-ui-extra/a11y`**: 15 WAI-ARIA APG pattern verifiers (`checkPattern`, `auditPattern`), LTR/RTL direction verifier (`checkDirection`), accessible-name verifier (`checkAccessibleNames`, `auditAccessibleNames`), and zero-DOM `A11yFocus.layer()` for `TestHost`.
- **`effect-ui-extra/page`**: zero-FOUC SSR `Preferences` / `ColorScheme` / `preferencesScript()`, `CspContext` nonce helpers, iOS modal touch jitter guard, `Deferred`-backed `Overlays` & `OverlayHost`, `LiveAnnouncer` & `LiveRegion`, scoped `ShortcutRegistry`, `checkServer` SSR purity verifier, semantic `PageObserver` & `PageHistory` with `undoAgent()`, `InputModalityTracker` (`PointerKind`), `hidden="until-found"` / `beforematch` helpers, `createThemeColorDimmer`, DOM `getTabbables`/`preserveFocusAcrossUpdate` walker, and `Form` `validationMode` + server-error focus helper.
- **`effect-ui-extra/widgets`**: headless `Command` (+ `fuzzyMatch`/`fuzzyFilter`), `Tree` (+ `recoverFocusKey`, tri-state `TreeChecked`), `Resizable`, `Listbox`, `PasswordInput` (`Schema.Redacted`), `TimeInput`, `DateTimePicker`, `TokenInput`, `Pagination`, `SegmentedControl` (+ `computeIndicatorGeometry`), `InlineEdit`, `Rating`, `ColorPicker`, `AreaPicker` (2D XY), `ScrollPicker` (momentum wheel), `Carousel`, `ImageCropper`, `Timeline`, `Waterfall`, `StickToBottom`, `TriggerMenu`, `InputHistory`, `inputHints`, `makeAsyncOptionsLoader`, and structured prompt tokens.
- **`effect-ui-extra/direct`**: 2D spatial/grid focus, `CellRange` & `computeLassoSelection`, `SwipeActions`, `TestClock`-deterministic `holdEffect`/`repeatStream`, cycle-safe `TreeReorder`, cross-container Kanban `transferItem`, infinite-canvas `Viewport`/`Connect`, quadratic edge `computeAutoScroll`, `TimeSpan` math, `NumberScale` (linear/log/custom + locale formatting/parsing), `draftMove` controller, 2D `computeVirtualGrid`, and CLDR `firstDayOfWeek` + `PlainDate` helpers.
- **`effect-ui-extra/theme`** & **`effect-ui-extra/theme/effect-ui.css`**: OKLCH / sRGB / Display-P3 gamut engine (`clampToGamut`, `mixOklch`, `generateScale`), `deltaEOK` perceptual distance, 148 CSS named colors, WCAG 2.1 + APCA contrast math (`wcagContrast`, `apcaContrast`, `auditThemeContrast`), `generateThemeCss`, and optional `@layer effect-ui` stylesheet with `light-dark()` and `[data-color-scheme]` integration.
- **`effect-ui-extra/motion`**: closed-form analytical springs (`solveSpring`, `settleTime`, `springLinearEasing` CSS `linear(...)`), `createVelocityTracker`, `projectDistance`, `rubberBand`, `resolveSnapPoints`/`findSnapIndex`, `reduceSheet`, `reduceScrollHandoff`, radial `sectorOf`, `reducePresence`, and `reduceCarousel`.
- **`effect-ui-extra/registry`** & **`effect-ui` CLI**: shadcn-style copy-paste styled Tailwind v4 + Effect UI registry with 64/64 shadcn `base/ui` parity (`70` total items including `cn`, `dialog-card`, `data-table`, and 3 full page blocks `block-dashboard`, `block-auth`, `block-ai-chat`), 5 WCAG-audited OKLCH visual presets (`nova`, `vega`, `maia`, `lyra`, `mira`), icon-pack switching (`inline-svg`, `lucide`, `tabler`), custom registry `validate`/`build`, JSON-RPC 2.0 `effect-ui mcp` stdio server, and `bunx effect-ui init|list|view|add|diff|preset|icon-pack|registry|mcp`.

Namespace imports are also available from the root entry (`import { A11y, Page, Widgets, Direct, Theme, Motion, Registry } from "effect-ui-extra"`).

## Verification

```bash
bun install
bun run verify
```

`bun run verify` runs `tsc --noEmit`, `tsc -p tsconfig.build.json`, `bun test`, `check:docs` (verifies `AGENTS.md` and `llms.txt` match `src/`), `check:consumer` (tests all 8 exports from an external consumer in both git-source and published-dist modes), and `check:size` (enforces per-subpath gzipped budgets in `size-budget.json`).

## License

MIT
