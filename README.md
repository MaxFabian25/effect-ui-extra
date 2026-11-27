# effect-ui-extra

Unified, tree-shakeable companion toolkit for `@effect/ui` and `@effect/ui-kit` on Bun and Effect 4. One package, one SHA pin, zero upstream fork rebase debt.

## Subpath exports

Install pinned to a commit SHA (`github:MaxFabian25/effect-ui-extra#<sha>`) and import only the subpaths you use:

- **`effect-ui-extra/a11y`**: 15 WAI-ARIA APG pattern verifiers (`checkPattern`, `auditPattern`), LTR/RTL direction verifier (`checkDirection`), accessible-name verifier (`checkAccessibleNames`, `auditAccessibleNames`), and zero-DOM `A11yFocus.layer()` for `TestHost`.
- **`effect-ui-extra/page`**: zero-FOUC SSR `Preferences` / `ColorScheme` / `preferencesScript()`, `Deferred`-backed `Overlays` & `OverlayHost`, `LiveAnnouncer` & `LiveRegion`, scoped `ShortcutRegistry`, `checkServer` SSR purity verifier, semantic `PageObserver` & `PageHistory` with `undoAgent()`, `InputModalityTracker` (`PointerKind`), `hidden="until-found"` / `beforematch` helpers, and `createThemeColorDimmer`.
- **`effect-ui-extra/widgets`**: headless `Command` (+ `fuzzyMatch`/`fuzzyFilter`), `Tree` (+ `recoverFocusKey`, tri-state `TreeChecked`), `Resizable`, `Listbox`, `PasswordInput` (`Schema.Redacted`), `TimeInput`, `TokenInput`, `Pagination`, `SegmentedControl` (+ `computeIndicatorGeometry`), `InlineEdit`, `Rating`, `ColorPicker`, `StickToBottom`, `TriggerMenu`, `InputHistory`, `inputHints`, and `makeAsyncOptionsLoader`.
- **`effect-ui-extra/direct`**: 2D spatial/grid focus, `CellRange` & `computeLassoSelection`, `SwipeActions`, `TestClock`-deterministic `holdEffect`/`repeatStream`, cycle-safe `TreeReorder`, infinite-canvas `Viewport`/`Connect`, quadratic edge `computeAutoScroll`, and `TimeSpan` manipulation.
- **`effect-ui-extra/theme`** & **`effect-ui-extra/theme/effect-ui.css`**: OKLCH / sRGB / Display-P3 gamut engine (`clampToGamut`, `mixOklch`, `generateScale`), WCAG 2.1 + APCA contrast math (`wcagContrast`, `apcaContrast`, `auditThemeContrast`), `generateThemeCss`, and optional `@layer effect-ui` stylesheet with `light-dark()` and `[data-color-scheme]` integration.
- **`effect-ui-extra/motion`**: closed-form analytical springs (`solveSpring`, `settleTime`, `springLinearEasing` CSS `linear(...)`), `createVelocityTracker`, `projectDistance`, `rubberBand`, `resolveSnapPoints`/`findSnapIndex`, `reduceSheet`, `reducePresence`, and `reduceCarousel`.

Namespace imports are also available from the root entry (`import { A11y, Page, Widgets, Direct, Theme, Motion } from "effect-ui-extra"`).

## Verification

```bash
bun install
bun run verify
```

`bun run verify` runs `tsc --noEmit`, `tsc -p tsconfig.build.json`, `bun test`, `check:docs` (verifies `AGENTS.md` and `llms.txt` match `src/`), `check:consumer` (tests all 8 exports from an external consumer in both git-source and published-dist modes), and `check:size` (enforces per-subpath gzipped budgets in `size-budget.json`).

## License

MIT
