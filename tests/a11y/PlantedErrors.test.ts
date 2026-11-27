import { UiSchema } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import { HtmlPlay } from "@effect/ui/html/testing"
import { TestHost } from "@effect/ui/testing"
import { describe, expect, it } from "bun:test"
import { Effect, Exit, Layer, Schema } from "effect"
import { TestClock } from "effect/testing"
import {
  A11yFocus,
  auditDirection,
  auditPattern,
  checkPattern,
  type Direction,
  type PatternViolation
} from "../../src/a11y/index.js"

const testLayer = Layer.mergeAll(
  TestHost.layer(),
  A11yFocus.layer(),
  TestClock.layer()
)

const runPlay = <A, E>(
  eff: Effect.Effect<
    A,
    E,
    TestHost.TestHost | A11yFocus.FocusTracker | Html.Host | TestClock.TestClock
  >
) => Effect.runPromise(eff.pipe(Effect.provide(testLayer)))

const rulesOf = (violations: ReadonlyArray<PatternViolation>): ReadonlyArray<string> =>
  violations.map((v) => v.rule)

// ---------------------------------------------------------------------------
// Clean baselines + single-fault planted mutants
// ---------------------------------------------------------------------------

const BoolMsg = UiSchema.TaggedEnum({ Toggle: {} })

const makeSwitch = (fault: "clean" | "no-name" | "bad-checked" | "div-no-space" | "triple") =>
  Html.component({
    name: `Switch_${fault}`,
    model: Schema.Boolean,
    message: BoolMsg
  }).make({
    init: () => false,
    update: { Toggle: ($) => !$.model },
    view: (h, checked) => {
      if (fault === "triple") {
        return h.div
          .attrs({ role: "switch", "aria-checked": "maybe" })
          .on("click", BoolMsg.Toggle())
      }
      if (fault === "div-no-space") {
        return h.div
          .attrs({
            role: "switch",
            tabindex: "0",
            "aria-label": "Notifications",
            "aria-checked": String(checked)
          })
          .on("click", BoolMsg.Toggle())
      }
      return h.button
        .attrs({
          type: "button",
          role: "switch",
          ...(fault === "no-name" ? {} : { "aria-label": "Notifications" }),
          "aria-checked": fault === "bad-checked" ? "mixed" : String(checked)
        })
        .on("click", BoolMsg.Toggle())
    }
  })

const makeCheckbox = (fault: "clean" | "enter-toggles" | "dangling-labelledby") =>
  Html.component({
    name: `Checkbox_${fault}`,
    model: Schema.Boolean,
    message: BoolMsg
  }).make({
    init: () => false,
    update: { Toggle: ($) => !$.model },
    view: (h, checked) => {
      const base = h.button
        .attrs({
          type: "button",
          role: "checkbox",
          "aria-checked": String(checked),
          ...(fault === "dangling-labelledby"
            ? { "aria-labelledby": "missing-label-id" }
            : { "aria-label": "Subscribe" })
        })
        .on("click", BoolMsg.Toggle())
      if (fault === "enter-toggles") return base
      return base.on(
        "keydown",
        ({ key }) => (key === "Enter" ? BoolMsg.Toggle() : undefined),
        { preventDefault: true }
      )
    }
  })

// Clean checkbox that swallows Enter without toggling (separate Noop message)
const CheckboxCleanMsg = UiSchema.TaggedEnum({ Toggle: {}, SwallowedEnter: {} })
const CleanCheckbox = Html.component({
  name: "CleanCheckbox",
  model: Schema.Boolean,
  message: CheckboxCleanMsg
}).make({
  init: () => false,
  update: {
    Toggle: ($) => !$.model,
    SwallowedEnter: ($) => $.model
  },
  view: (h, checked) =>
    h.button
      .attrs({
        type: "button",
        role: "checkbox",
        "aria-label": "Subscribe",
        "aria-checked": String(checked)
      })
      .on("click", CheckboxCleanMsg.Toggle())
      .on(
        "keydown",
        ({ key }) => (key === "Enter" ? CheckboxCleanMsg.SwallowedEnter() : undefined),
        { preventDefault: true }
      )
})

const makeDisclosure = (fault: "clean" | "dangling-controls" | "stays-hidden") =>
  Html.component({
    name: `Disclosure_${fault}`,
    model: Schema.Boolean,
    message: BoolMsg
  }).make({
    init: () => false,
    update: { Toggle: ($) => !$.model },
    view: (h, open) =>
      h.div(
        h.button
          .attrs({
            type: "button",
            "aria-expanded": String(open),
            ...(open
              ? {
                  "aria-controls":
                    fault === "dangling-controls" ? "ghost-panel" : "panel-1"
                }
              : {})
          })
          .on("click", BoolMsg.Toggle())
          .children("More details"),
        open
          ? h.div
              .attrs({
                id: "panel-1",
                ...(fault === "stays-hidden" ? { hidden: "" } : {})
              })
              .children("Panel content")
          : undefined
      )
  })

const TabMsg = UiSchema.TaggedEnum({
  Focus: { index: Schema.Number },
  Select: { index: Schema.Number },
  Focused: {}
})

const tabRefs = [
  Html.ref("PlantedTab0", "button"),
  Html.ref("PlantedTab1", "button"),
  Html.ref("PlantedTab2", "button")
] as const

const makeTabs = (
  fault:
    | "clean"
    | "two-tabstops"
    | "zero-tabstops"
    | "broken-keys"
    | "tabindex-without-focus"
    | "ignore-rtl"
    | "missing-panel-labelledby",
  direction: Direction = "ltr"
) =>
  Html.component({
    name: `Tabs_${fault}_${direction}`,
    model: Schema.Struct({ active: Schema.Number, focused: Schema.Number }),
    message: TabMsg
  }).make({
    init: () => ({ active: 0, focused: 0 }),
    update: {
      Focus: ($, { index }) => {
        const next = $.evolve({ focused: index })
        if (fault === "tabindex-without-focus") return next
        return next.run(
          HtmlCommand.focus(tabRefs[index]!, () => TabMsg.Focused())
        )
      },
      Select: ($, { index }) => $.evolve({ active: index, focused: index }),
      Focused: ($) => $.model
    },
    view: (h, model) => {
      const names = ["First", "Second", "Third"]
      const effDir = fault === "ignore-rtl" ? "ltr" : direction
      return h.div(
        h.div.attrs({ role: "tablist" }).children(
          ...names.map((label, i) => {
            const tabIndex =
              fault === "two-tabstops"
                ? i < 2
                  ? "0"
                  : "-1"
                : fault === "zero-tabstops"
                ? "-1"
                : model.focused === i
                ? "0"
                : "-1"
            return h.button
              .ref(tabRefs[i]!)
              .attrs({
                type: "button",
                id: `tab-${i}`,
                role: "tab",
                "aria-selected": String(model.active === i),
                "aria-controls": `panel-${i}`,
                tabindex: tabIndex
              })
              .on("click", TabMsg.Select({ index: i }))
              .on("focus", TabMsg.Focus({ index: i }))
              .on(
                "keydown",
                ({ key }) => {
                  if (fault === "broken-keys") return undefined
                  const next = effDir === "rtl" ? "ArrowLeft" : "ArrowRight"
                  const prev = effDir === "rtl" ? "ArrowRight" : "ArrowLeft"
                  if (key === next) return TabMsg.Focus({ index: (i + 1) % names.length })
                  if (key === prev)
                    return TabMsg.Focus({ index: (i - 1 + names.length) % names.length })
                  if (key === "Home") return TabMsg.Focus({ index: 0 })
                  if (key === "End") return TabMsg.Focus({ index: names.length - 1 })
                  return undefined
                },
                { preventDefault: true }
              )
              .children(label)
          })
        ),
        h.div
          .attrs({
            id: `panel-${model.active}`,
            role: "tabpanel",
            ...(fault === "missing-panel-labelledby"
              ? {}
              : { "aria-labelledby": `tab-${model.active}` })
          })
          .children(`Body ${model.active}`)
      )
    }
  })

const DoubleCheckedRadios = Html.component({
  name: "DoubleCheckedRadios",
  model: Schema.Null,
  message: Schema.Never
}).make({
  init: () => null,
  update: ($) => $.model,
  view: (h) =>
    h.div.attrs({ role: "radiogroup", "aria-label": "Plan" }).children(
      h.button.attrs({
        type: "button",
        role: "radio",
        "aria-label": "Free",
        "aria-checked": "true",
        tabindex: "0"
      }),
      h.button.attrs({
        type: "button",
        role: "radio",
        "aria-label": "Pro",
        "aria-checked": "true",
        tabindex: "-1"
      })
    )
})

const OutOfRangeSlider = Html.component({
  name: "OutOfRangeSlider",
  model: Schema.Number,
  message: Schema.Never
}).make({
  init: () => 150,
  update: ($) => $.model,
  view: (h, val) =>
    h.div.attrs({
      role: "slider",
      tabindex: "0",
      "aria-label": "Volume",
      "aria-valuemin": "0",
      "aria-valuemax": "100",
      "aria-valuenow": String(val)
    })
})

const AlertDialogNoDesc = Html.component({
  name: "AlertDialogNoDesc",
  model: Schema.Null,
  message: Schema.Never
}).make({
  init: () => null,
  update: ($) => $.model,
  view: (h) =>
    h.div.attrs({ role: "alertdialog", "aria-labelledby": "dlg-title" }).children(
      h.h2.attrs({ id: "dlg-title" }).children("Delete account?"),
      h.button.attrs({ type: "button" }).children("Cancel")
    )
})

const DanglingActiveDescendantListbox = Html.component({
  name: "DanglingActiveDescendantListbox",
  model: Schema.Null,
  message: Schema.Never
}).make({
  init: () => null,
  update: ($) => $.model,
  view: (h) =>
    h.div
      .attrs({
        role: "listbox",
        tabindex: "0",
        "aria-label": "Colors",
        "aria-activedescendant": "opt-deleted"
      })
      .children(
        h.div.attrs({ id: "opt-1", role: "option", "aria-selected": "true" }).children("Red"),
        h.div.attrs({ id: "opt-2", role: "option", "aria-selected": "false" }).children("Blue")
      )
})

const TreeMsg = UiSchema.TaggedEnum({
  Focus: { index: Schema.Number },
  Focused: {}
})
const treeRefs = [
  Html.ref("PlantedTree0", "li"),
  Html.ref("PlantedTree1", "li"),
  Html.ref("PlantedTree2", "li")
] as const
const makeTree = (fault: "clean" | "bad-expanded-and-keys") =>
  Html.component({
    name: `Tree_${fault}`,
    model: Schema.Number,
    message: TreeMsg
  }).make({
    init: () => 0,
    update: {
      Focus: ($, { index }) =>
        $.set(index).run(HtmlCommand.focus(treeRefs[index]!, () => TreeMsg.Focused())),
      Focused: ($) => $.model
    },
    view: (h, focused) =>
      h.ul.attrs({ role: "tree", "aria-label": "Files" }).children(
        ...["src", "tests", "README.md"].map((label, i) =>
          h.li
            .ref(treeRefs[i]!)
            .attrs({
              role: "treeitem",
              tabindex: focused === i ? "0" : "-1",
              ...(i === 0
                ? {
                    "aria-expanded":
                      fault === "bad-expanded-and-keys" ? "open" : "false"
                  }
                : {})
            })
            .on("focus", TreeMsg.Focus({ index: i }))
            .on(
              "keydown",
              ({ key }) => {
                if (fault === "bad-expanded-and-keys") return undefined
                if (key === "ArrowDown") return TreeMsg.Focus({ index: Math.min(2, i + 1) })
                if (key === "ArrowUp") return TreeMsg.Focus({ index: Math.max(0, i - 1) })
                if (key === "Home") return TreeMsg.Focus({ index: 0 })
                if (key === "End") return TreeMsg.Focus({ index: 2 })
                return undefined
              },
              { preventDefault: true }
            )
            .children(label)
        )
      )
  })

describe("Planted-error verification (clean baselines pass, every planted APG fault caught)", () => {
  it("Switch: clean baseline passes; missing name, bad aria-checked, and broken Space toggle are each caught", () =>
    runPlay(
      Effect.gen(function*() {
        const clean = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(makeSwitch("clean"), {}), (p) =>
            auditPattern(p, "switch")
          )
        )
        expect(clean).toEqual([])

        const noName = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(makeSwitch("no-name"), {}), (p) =>
            auditPattern(p, "switch")
          )
        )
        expect(rulesOf(noName)).toContain("accessible-name")

        const badChecked = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(makeSwitch("bad-checked"), {}), (p) =>
            auditPattern(p, "switch")
          )
        )
        expect(rulesOf(badChecked)).toContain("aria-checked-valid")

        const noSpace = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(makeSwitch("div-no-space"), {}), (p) =>
            auditPattern(p, "switch")
          )
        )
        expect(rulesOf(noSpace)).toContain("keyboard-space-toggle")
      })
    ))

  it("Switch: collects ALL 3 simultaneous violations into one PatternViolationError", () =>
    runPlay(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(makeSwitch("triple"), {})
          const exit = yield* Effect.exit(checkPattern(play, "switch"))
          expect(Exit.isFailure(exit)).toBe(true)
          if (Exit.isFailure(exit)) {
            const err = exit.cause.reasons[0]
            expect(err?._tag).toBe("Fail")
            if (err?._tag === "Fail") {
              const rules = rulesOf(err.error.violations)
              expect(rules).toContain("accessible-name")
              expect(rules).toContain("aria-checked-valid")
              expect(rules).toContain("focusable")
              expect(err.error.violations.length).toBe(3)
            }
          }
        })
      )
    ))

  it("Checkbox: clean baseline passes; Enter-toggles and dangling aria-labelledby are caught", () =>
    runPlay(
      Effect.gen(function*() {
        const clean = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(CleanCheckbox, {}), (p) =>
            auditPattern(p, "checkbox")
          )
        )
        expect(clean).toEqual([])

        const enterToggles = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(makeCheckbox("enter-toggles"), {}), (p) =>
            auditPattern(p, "checkbox")
          )
        )
        expect(rulesOf(enterToggles)).toContain("keyboard-enter-no-toggle")

        const dangling = yield* Effect.scoped(
          Effect.flatMap(
            HtmlPlay.make(makeCheckbox("dangling-labelledby"), {}),
            (p) => auditPattern(p, "checkbox")
          )
        )
        expect(rulesOf(dangling)).toContain("aria-labelledby-ref")
        expect(rulesOf(dangling)).toContain("accessible-name")
      })
    ))

  it("Disclosure: clean baseline passes; dangling aria-controls and hidden controlled panel are caught", () =>
    runPlay(
      Effect.gen(function*() {
        const clean = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(makeDisclosure("clean"), {}), (p) =>
            auditPattern(p, "disclosure")
          )
        )
        expect(clean).toEqual([])

        const dangling = yield* Effect.scoped(
          Effect.flatMap(
            HtmlPlay.make(makeDisclosure("dangling-controls"), {}),
            (p) => auditPattern(p, "disclosure")
          )
        )
        expect(rulesOf(dangling)).toContain("aria-controls-ref")

        const hidden = yield* Effect.scoped(
          Effect.flatMap(
            HtmlPlay.make(makeDisclosure("stays-hidden"), {}),
            (p) => auditPattern(p, "disclosure")
          )
        )
        expect(rulesOf(hidden)).toContain("controlled-panel-visible")
      })
    ))

  it("Tabs: clean baseline passes in LTR & RTL; two tabstops, zero tabstops, broken keys, missing panel aria-labelledby, and broken RTL reversal are caught", () =>
    runPlay(
      Effect.gen(function*() {
        const cleanDir = yield* auditDirection(
          (dir) => HtmlPlay.make(makeTabs("clean", dir), {}),
          "tabs"
        )
        expect(cleanDir.ltr).toEqual([])
        expect(cleanDir.rtl).toEqual([])

        const twoStops = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(makeTabs("two-tabstops"), {}), (p) =>
            auditPattern(p, "tabs", { staticOnly: true })
          )
        )
        expect(rulesOf(twoStops)).toContain("roving-tabindex-count")

        const zeroStops = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(makeTabs("zero-tabstops"), {}), (p) =>
            auditPattern(p, "tabs", { staticOnly: true })
          )
        )
        expect(rulesOf(zeroStops)).toContain("roving-tabindex-count")

        const brokenKeys = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(makeTabs("broken-keys"), {}), (p) =>
            auditPattern(p, "tabs")
          )
        )
        expect(rulesOf(brokenKeys)).toContain("keyboard-arrow-forward")
        expect(rulesOf(brokenKeys)).toContain("keyboard-end")

        const noFocusCmd = yield* Effect.scoped(
          Effect.flatMap(
            HtmlPlay.make(makeTabs("tabindex-without-focus"), {}),
            (p) => auditPattern(p, "tabs")
          )
        )
        expect(rulesOf(noFocusCmd)).toContain("keyboard-arrow-forward")

        const noPanelLabel = yield* Effect.scoped(
          Effect.flatMap(
            HtmlPlay.make(makeTabs("missing-panel-labelledby"), {}),
            (p) => auditPattern(p, "tabs", { staticOnly: true })
          )
        )
        expect(rulesOf(noPanelLabel)).toContain("tabpanel-labelledby")

        const rtlBroken = yield* auditDirection(
          (dir) => HtmlPlay.make(makeTabs("ignore-rtl", dir), {}),
          "tabs"
        )
        expect(rtlBroken.ltr).toEqual([])
        expect(rulesOf(rtlBroken.rtl)).toContain("keyboard-arrow-forward")
      })
    ))

  it("RadioGroup, Slider, AlertDialog, Listbox, and Tree planted faults are each caught", () =>
    runPlay(
      Effect.gen(function*() {
        const doubleRadio = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(DoubleCheckedRadios, {}), (p) =>
            auditPattern(p, "radio-group", { staticOnly: true })
          )
        )
        expect(rulesOf(doubleRadio)).toContain("radio-single-checked")

        const badSlider = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(OutOfRangeSlider, {}), (p) =>
            auditPattern(p, "slider")
          )
        )
        expect(rulesOf(badSlider)).toContain("slider-value-range")
        expect(rulesOf(badSlider)).toContain("keyboard-end")
        expect(rulesOf(badSlider)).toContain("keyboard-home")

        const noDescAlert = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(AlertDialogNoDesc, {}), (p) =>
            auditPattern(p, "alertdialog", { staticOnly: true })
          )
        )
        expect(rulesOf(noDescAlert)).toContain("alertdialog-describedby")

        const badListbox = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(DanglingActiveDescendantListbox, {}), (p) =>
            auditPattern(p, "listbox", { staticOnly: true })
          )
        )
        expect(rulesOf(badListbox)).toContain("aria-activedescendant-ref")

        const cleanTree = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(makeTree("clean"), {}), (p) =>
            auditPattern(p, "tree")
          )
        )
        expect(cleanTree).toEqual([])

        const brokenTree = yield* Effect.scoped(
          Effect.flatMap(HtmlPlay.make(makeTree("bad-expanded-and-keys"), {}), (p) =>
            auditPattern(p, "tree")
          )
        )
        expect(rulesOf(brokenTree)).toContain("treeitem-aria-expanded")
        expect(rulesOf(brokenTree)).toContain("tree-arrow-down")
      })
    ))
})
