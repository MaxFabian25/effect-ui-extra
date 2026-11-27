# effect-ui-extra (AGENTS.md)

Version: `0.3.0` (generated from `src/` via `bun run gen:docs`; read `llms.txt` in this package for the full symbol index).

## Rules for agents using this package

1. **Import by subpath.** Prefer `effect-ui-extra/widgets`, `effect-ui-extra/page`, `effect-ui-extra/a11y`, `effect-ui-extra/direct`, `effect-ui-extra/theme`, `effect-ui-extra/theme/effect-ui.css`, and `effect-ui-extra/motion` over the root barrel so unused modules stay out of client bundles.
2. **Pair zero-FOUC theme persistence with the layered stylesheet.** Inline `preferencesScript()` from `effect-ui-extra/page` in SSR `<head>` and import `effect-ui-extra/theme/effect-ui.css`; both coordinate on `:root[data-color-scheme="light"|"dark"]`.
3. **Run all four built-in audits in UI tests.** Under `bun test` with `TestHost.layer()`, `A11yFocus.layer()`, and `TestClock.layer()`:
   - `checkPattern(play, pattern)` and `checkDirection(...)` from `effect-ui-extra/a11y`
   - `checkAccessibleNames(play)` from `effect-ui-extra/a11y`
   - `checkServer(Component, props)` from `effect-ui-extra/page`
   - `auditThemeContrast(themeContrastPairs(tokens))` from `effect-ui-extra/theme`
4. **Keep secrets redacted.** Use `PasswordInput` (`Schema.Redacted`) and `PageObserver`/`PageHistory` redaction so secrets never serialize into SSR state or undo logs.
5. **Respect Effect 4 conventions.** `Stream.runCollect` returns `Array<A>` directly, `Queue.offerUnsafe(queue, value)` is a module function, and forked test fibers that must register before `TestHost.settle` need `{ startImmediately: true }`.

## Subpath reference

| Import path | Exports | Covers |
| --- | --- | --- |
| `effect-ui-extra/a11y` | 9 values, 14 types | 15 WAI-ARIA APG pattern verifiers, LTR/RTL direction checks, accessible-name checks, and zero-DOM TestHost focus tracking. |
| `effect-ui-extra/page` | 64 values, 45 types | Zero-FOUC SSR preferences and color scheme, CspContext nonce helpers, iOS modal touch jitter guard, Deferred-backed overlays, LiveAnnouncer, scoped ShortcutRegistry, checkServer SSR purity guard, semantic PageObserver/PageHistory with undoAgent(), InputModalityTracker, hidden="until-found" helpers, and theme-color dimming. |
| `effect-ui-extra/widgets` | 100 values, 37 types | Headless application widgets and AI-chat controls complementing @effect/ui-kit (Command, Tree, Resizable, Listbox, PasswordInput, TimeInput, TokenInput, Pagination, SegmentedControl, InlineEdit, Rating, ColorPicker, Carousel, ImageCropper, Timeline, Waterfall, StickToBottom, TriggerMenu, InputHistory, inputHints, TreeChecked, AsyncOptions). |
| `effect-ui-extra/direct` | 35 values, 36 types | Pure 2D spatial/grid focus, CellRange and lasso selection, SwipeActions, TestClock-driven holdEffect/repeatStream, cycle-safe TreeReorder, cross-container Kanban transfer, infinite canvas Viewport/Connect, quadratic edge AutoScroll, and TimeSpan math. |
| `effect-ui-extra/theme` | 28 values, 6 types | OKLCH/sRGB/Display-P3 color engine, hue-preserving gamut clamping, WCAG 2.1 and APCA contrast auditing, theme CSS generation, and opt-in @layer effect-ui stylesheet (effect-ui-extra/theme/effect-ui.css). |
| `effect-ui-extra/motion` | 22 values, 22 types | Closed-form analytical springs, compositor CSS linear() easing, pointer velocity tracker, momentum projection, rubber-band overscroll, snap points, draggable sheet reducer, scroll-to-drag handoff, Presence lifecycle, and Carousel reducer. |
| `effect-ui-extra/registry` | 27 values, 12 types | shadcn-style copy-paste styled component registry, 5 WCAG-audited OKLCH visual presets (nova, vega, maia, lyra, mira), 27 Tailwind v4 + Effect UI app/AI blueprints and page blocks, and the effect-ui CLI (init, list, view, add, diff, preset). |
| `effect-ui-extra/theme/effect-ui.css` | CSS layer | Opt-in `@layer effect-ui` tokens and control styles |
