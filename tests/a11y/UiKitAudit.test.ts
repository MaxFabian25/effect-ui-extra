import { UiSchema } from "@effect/ui"
import {
  Accordion,
  AccordionItem,
  AlertDialog,
  Checkbox,
  Collapsible,
  Combobox,
  Dialog,
  DirectionProvider,
  Menu,
  RadioGroup,
  Select,
  Slider,
  Switch,
  Tabs,
  Toolbar
} from "@effect/ui-kit"
import { Html } from "@effect/ui/html"
import { HtmlPlay } from "@effect/ui/html/testing"
import { TestHost } from "@effect/ui/testing"
import { describe, it } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { TestClock } from "effect/testing"
import { A11yFocus, checkDirection, checkPattern, type Direction } from "../../src/a11y/index.js"

const testLayer = Layer.mergeAll(
  TestHost.layer(),
  A11yFocus.layer(),
  TestClock.layer()
)

const runPlay = <A, E>(
  eff: Effect.Effect<A, E, TestHost.TestHost | A11yFocus.FocusTracker | Html.Host | TestClock.TestClock>
) => Effect.runPromise(eff.pipe(Effect.provide(testLayer)))

// ---------------------------------------------------------------------------
// 1. Switch
// ---------------------------------------------------------------------------
const SwitchMsg = UiSchema.TaggedEnum({ Toggled: { checked: Schema.Boolean } })
const SwitchDemo = Html.component({
  name: "SwitchDemo",
  model: Schema.Boolean,
  message: SwitchMsg
}).make({
  init: () => false,
  update: { Toggled: (_, { checked }) => checked },
  view: (h, checked) =>
    Switch(h, {
      props: { checked },
      onToggle: ({ checked: next }) => SwitchMsg.Toggled({ checked: next }),
      view: (sw) =>
        h.div(
          sw.root(h.button.attr("aria-label", "Dark mode")).children(
            sw.thumb(h.span)
          )
        )
    })
})

// ---------------------------------------------------------------------------
// 2. Checkbox
// ---------------------------------------------------------------------------
const CheckboxMsg = UiSchema.TaggedEnum({ Toggled: { checked: Schema.Boolean } })
const CheckboxDemo = Html.component({
  name: "CheckboxDemo",
  model: Schema.Boolean,
  message: CheckboxMsg
}).make({
  init: () => false,
  update: { Toggled: (_, { checked }) => checked },
  view: (h, checked) =>
    Checkbox(h, {
      props: { checked },
      onEmit: {
        Toggled: ({ checked: next }) => CheckboxMsg.Toggled({ checked: next })
      },
      view: (cb) =>
        h.label(
          cb.root(h.button.attr("aria-label", "Accept terms")).children(
            cb.indicator(h.span)
          ),
          "Accept terms"
        )
    })
})

// ---------------------------------------------------------------------------
// 3. Collapsible (disclosure)
// ---------------------------------------------------------------------------
const CollapsibleMsg = UiSchema.TaggedEnum({ Toggled: { open: Schema.Boolean } })
const CollapsibleDemo = Html.component({
  name: "CollapsibleDemo",
  model: Schema.Boolean,
  message: CollapsibleMsg
}).make({
  init: () => false,
  update: { Toggled: (_, { open }) => open },
  view: (h, open) =>
    Collapsible(h, {
      props: { open },
      onEmit: {
        Toggled: ({ open: next }) => CollapsibleMsg.Toggled({ open: next }),
        Settled: () => undefined
      },
      view: (col) =>
        col.root(h.div).children(
          col.trigger(h.button).children("Details"),
          col.panel(h.div)?.children("More information")
        )
    })
})

// ---------------------------------------------------------------------------
// 4. Accordion
// ---------------------------------------------------------------------------
const AccordionMsg = UiSchema.TaggedEnum({
  Toggled: { value: Schema.String, open: Schema.Boolean }
})
const AccordionDemo = Html.component({
  name: "AccordionDemo",
  model: Schema.Array(Schema.String),
  message: AccordionMsg
}).make({
  init: () => ["faq-1"],
  update: {
    Toggled: ($, { open, value }) =>
      open
        ? [...$.model.filter((v) => v !== value), value]
        : $.model.filter((v) => v !== value)
  },
  view: (h, openValues) =>
    Accordion(h, {
      props: { value: openValues },
      view: (acc) =>
        acc.root(h.div).children(
          ...([
            ["faq-1", "Shipping", "Ships in 2 days."],
            ["faq-2", "Returns", "30-day returns."]
          ] as const).map(([value, title, body], index) =>
            AccordionItem(h, {
              key: value,
              props: { value, index },
              onEmit: {
                Toggled: ({ open }) => AccordionMsg.Toggled({ value, open }),
                Settled: () => undefined
              },
              view: (item) =>
                item.root(h.div).children(
                  item.header(h.h3).children(
                    item.trigger(h.button).children(title)
                  ),
                  item.panel(h.div)?.children(body)
                )
            })
          )
        )
    })
})

// ---------------------------------------------------------------------------
// 5. Tabs (with DirectionProvider + orientation)
// ---------------------------------------------------------------------------
const TabsMsg = UiSchema.TaggedEnum({ Selected: { value: Schema.String } })
const TabsDemo = Html.component({
  name: "TabsDemo",
  props: Schema.Struct({
    direction: Schema.Literals(["ltr", "rtl"]),
    orientation: Schema.optional(Schema.Literals(["horizontal", "vertical"]))
  }),
  model: Schema.String,
  message: TabsMsg
}).make({
  init: () => "overview",
  update: { Selected: (_, { value }) => value },
  view: (h, tab) =>
    DirectionProvider(h, {
      props: { direction: h.props.direction },
      view: () =>
        Tabs(h, {
          props: {
            value: tab,
            orientation: h.props.orientation,
            tabs: [
              { value: "overview" },
              { value: "projects" },
              { value: "settings" }
            ]
          },
          onEmit: { Selected: ({ value }) => TabsMsg.Selected({ value }) },
          view: (tabs) =>
            tabs.root(h.div).children(
              tabs.list(h.div).children(
                tabs.tab({ element: h.button, value: "overview" }).children("Overview"),
                tabs.tab({ element: h.button, value: "projects" }).children("Projects"),
                tabs.tab({ element: h.button, value: "settings" }).children("Settings")
              ),
              tabs.panel({ element: h.div, value: "overview" })?.children("Overview body"),
              tabs.panel({ element: h.div, value: "projects" })?.children("Projects body"),
              tabs.panel({ element: h.div, value: "settings" })?.children("Settings body")
            )
        })
    })
})

// ---------------------------------------------------------------------------
// 6. RadioGroup (with DirectionProvider)
// ---------------------------------------------------------------------------
const RadioMsg = UiSchema.TaggedEnum({ Picked: { value: Schema.String } })
const RadioDemo = Html.component({
  name: "RadioDemo",
  props: Schema.Struct({ direction: Schema.Literals(["ltr", "rtl"]) }),
  model: Schema.String,
  message: RadioMsg
}).make({
  init: () => "ssd",
  update: { Picked: (_, { value }) => value },
  view: (h, value) =>
    DirectionProvider(h, {
      props: { direction: h.props.direction },
      view: () =>
        RadioGroup(h, {
          props: {
            value,
            items: [
              { value: "ssd" },
              { value: "hdd", disabled: true },
              { value: "nvme" }
            ]
          },
          onEmit: { Picked: ({ value: next }) => RadioMsg.Picked({ value: next }) },
          view: (rg) =>
            rg.root(h.div.attr("aria-label", "Storage")).children(
              rg.radio({ element: h.button.attr("aria-label", "SSD"), value: "ssd" }),
              rg.radio({ element: h.button.attr("aria-label", "HDD"), value: "hdd" }),
              rg.radio({ element: h.button.attr("aria-label", "NVMe"), value: "nvme" })
            )
        })
    })
})

// ---------------------------------------------------------------------------
// 7. Toolbar (with DirectionProvider + orientation)
// ---------------------------------------------------------------------------
const ToolbarDemo = Html.component({
  name: "ToolbarDemo",
  props: Schema.Struct({
    direction: Schema.Literals(["ltr", "rtl"]),
    orientation: Schema.optional(Schema.Literals(["horizontal", "vertical"]))
  }),
  model: Schema.Null,
  message: Schema.Never
}).make({
  init: () => null,
  update: ($) => $.model,
  view: (h) =>
    DirectionProvider(h, {
      props: { direction: h.props.direction },
      view: () =>
        Toolbar(h, {
          props: {
            orientation: h.props.orientation,
            items: [{ value: "bold" }, { value: "italic" }, { value: "underline" }]
          },
          view: (tb) =>
            tb.root(h.div.attr("aria-label", "Formatting")).children(
              tb.button({ element: h.button, value: "bold" }).children("Bold"),
              tb.button({ element: h.button, value: "italic" }).children("Italic"),
              tb.button({ element: h.button, value: "underline" }).children("Underline")
            )
        })
    })
})

// ---------------------------------------------------------------------------
// 8. Slider (with DirectionProvider + orientation)
// ---------------------------------------------------------------------------
const SliderMsg = UiSchema.TaggedEnum({ Moved: { value: Schema.Number } })
const SliderDemo = Html.component({
  name: "SliderDemo",
  props: Schema.Struct({
    direction: Schema.Literals(["ltr", "rtl"]),
    orientation: Schema.optional(Schema.Literals(["horizontal", "vertical"]))
  }),
  model: Schema.Number,
  message: SliderMsg
}).make({
  init: () => 50,
  update: { Moved: (_, { value }) => value },
  view: (h, value) =>
    DirectionProvider(h, {
      props: { direction: h.props.direction },
      view: () =>
        Slider(h, {
          props: {
            value,
            min: 0,
            max: 100,
            step: 5,
            orientation: h.props.orientation
          },
          onEmit: {
            Moved: ({ value: next }) =>
              SliderMsg.Moved({ value: Array.isArray(next) ? next[0]! : next }),
            Committed: () => undefined
          },
          view: (sl) =>
            sl.root(h.div).children(
              sl.control(h.div).children(
                sl.track(h.div).children(
                  sl.indicator(h.div),
                  sl.thumb({
                    element: h.div,
                    input: h.input.attr("aria-label", "Volume")
                  })
                )
              )
            )
        })
    })
})

// ---------------------------------------------------------------------------
// 9. Dialog
// ---------------------------------------------------------------------------
const DialogMsg = UiSchema.TaggedEnum({ Opened: {}, Closed: {} })
const DialogDemo = Html.component({
  name: "DialogDemo",
  model: Schema.Boolean,
  message: DialogMsg
}).make({
  init: () => false,
  update: { Opened: () => true, Closed: () => false },
  view: (h, open) =>
    Dialog(h, {
      props: { open },
      onEmit: {
        RequestedOpen: () => DialogMsg.Opened(),
        RequestedClose: () => DialogMsg.Closed(),
        Settled: () => undefined
      },
      view: (d) =>
        h.div(
          d.trigger(h.button).children("Open settings"),
          d.portal(h.dialog)?.children(
            d.popup(h.div).children(
              d.title(h.h2).children("Workspace settings"),
              d.description(h.p).children("Configure workspace preferences."),
              d.close(h.button).children("Close")
            )
          )
        )
    })
})

// ---------------------------------------------------------------------------
// 10. AlertDialog
// ---------------------------------------------------------------------------
const AlertDialogDemo = Html.component({
  name: "AlertDialogDemo",
  model: Schema.Boolean,
  message: DialogMsg
}).make({
  init: () => false,
  update: { Opened: () => true, Closed: () => false },
  view: (h, open) =>
    AlertDialog(h, {
      props: { open },
      onEmit: {
        RequestedOpen: () => DialogMsg.Opened(),
        RequestedClose: () => DialogMsg.Closed(),
        Settled: () => undefined
      },
      view: (d) =>
        h.div(
          d.trigger(h.button).children("Delete project"),
          d.portal(h.dialog)?.children(
            d.popup(h.div).children(
              d.title(h.h2).children("Delete project?"),
              d.description(h.p).children("This action cannot be undone."),
              d.close(h.button).children("Cancel")
            )
          )
        )
    })
})

// ---------------------------------------------------------------------------
// 11. Select (combobox + listbox)
// ---------------------------------------------------------------------------
const SelectMsg = UiSchema.TaggedEnum({
  Opened: {},
  Closed: {},
  Picked: { value: Schema.String }
})
const selectItems = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" }
]
const SelectDemo = Html.component({
  name: "SelectDemo",
  model: Schema.Struct({ open: Schema.Boolean, value: Schema.String }),
  message: SelectMsg
}).make({
  init: () => ({ open: false, value: "light" }),
  update: {
    Opened: ($) => $.evolve({ open: true }),
    Closed: ($) => $.evolve({ open: false }),
    Picked: ($, { value }) => $.evolve({ value })
  },
  view: (h, model) =>
    Select(h, {
      props: { open: model.open, value: model.value, items: selectItems },
      onEmit: {
        RequestedOpen: () => SelectMsg.Opened(),
        RequestedClose: () => SelectMsg.Closed(),
        Picked: ({ value }) => SelectMsg.Picked({ value: String(value) }),
        Settled: () => undefined
      },
      view: (sel) =>
        h.div(
          sel.label(h.div).children("Theme"),
          sel.trigger(h.button).children(sel.value(h.span)),
          model.open
            ? sel.positioner(h.div).children(
                sel.popup(h.div).children(
                  ...selectItems.map(({ label, value }) =>
                    sel.item({ element: h.div, value }).children(
                      sel.itemText(h.div).children(label)
                    )
                  )
                )
              )
            : undefined
        )
    })
})

// ---------------------------------------------------------------------------
// 12. Combobox
// ---------------------------------------------------------------------------
const ComboMsg = UiSchema.TaggedEnum({
  Opened: {},
  Closed: {},
  Picked: { value: Schema.NullOr(Schema.String) },
  Typed: { inputValue: Schema.String }
})
const comboItems = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" }
]
const ComboboxDemo = Html.component({
  name: "ComboboxDemo",
  model: Schema.Struct({
    open: Schema.Boolean,
    value: Schema.NullOr(Schema.String),
    inputValue: Schema.String
  }),
  message: ComboMsg
}).make({
  init: () => ({ open: false, value: null, inputValue: "" }),
  update: {
    Opened: ($) => $.evolve({ open: true }),
    Closed: ($) => $.evolve({ open: false }),
    Picked: ($, { value }) => $.evolve({ value }),
    Typed: ($, { inputValue }) => $.evolve({ inputValue })
  },
  view: (h, model) =>
    Combobox(h, {
      props: {
        open: model.open,
        value: model.value,
        inputValue: model.inputValue,
        items: comboItems
      },
      onEmit: {
        RequestedOpen: () => ComboMsg.Opened(),
        RequestedClose: () => ComboMsg.Closed(),
        Picked: ({ value }) =>
          ComboMsg.Picked({ value: Array.isArray(value) ? (value[0] ?? null) : value }),
        RequestedInputValue: ({ inputValue }) => ComboMsg.Typed({ inputValue }),
        Highlighted: () => undefined,
        Settled: () => undefined
      },
      view: (cb) =>
        h.div(
          cb.inputGroup(h.div).children(
            cb.input(h.input.attr("aria-label", "Fruit")),
            cb.trigger(h.button.attr("aria-label", "Open fruits")).children("v")
          ),
          model.open
            ? cb.positioner(h.div).children(
                cb.popup(h.div).children(
                  cb.list(h.div).children(
                    ...cb.items.map(({ label, value }) =>
                      cb.item({ element: h.div, value }).children(label)
                    )
                  )
                )
              )
            : undefined
        )
    })
})

// ---------------------------------------------------------------------------
// 13. Menu
// ---------------------------------------------------------------------------
const MenuMsg = UiSchema.TaggedEnum({
  Opened: {},
  Closed: {},
  ToggledWrap: { checked: Schema.Boolean }
})
const MenuDemo = Html.component({
  name: "MenuDemo",
  model: Schema.Struct({ open: Schema.Boolean, wrap: Schema.Boolean }),
  message: MenuMsg
}).make({
  init: () => ({ open: false, wrap: true }),
  update: {
    Opened: ($) => $.evolve({ open: true }),
    Closed: ($) => $.evolve({ open: false }),
    ToggledWrap: ($, { checked }) => $.evolve({ wrap: checked })
  },
  view: (h, model) =>
    Menu(h, {
      props: {
        open: model.open,
        items: [
          { value: "copy", label: "Copy" },
          { value: "paste", label: "Paste" },
          { value: "wrap", label: "Wrap lines", checked: model.wrap }
        ]
      },
      onEmit: {
        RequestedOpen: () => MenuMsg.Opened(),
        RequestedClose: () => MenuMsg.Closed(),
        Picked: ({ checked, value }) =>
          value === "wrap" && checked !== undefined
            ? MenuMsg.ToggledWrap({ checked })
            : undefined,
        Highlighted: () => undefined,
        RequestedQuery: () => undefined,
        Settled: () => undefined
      },
      view: (menu) =>
        h.div(
          menu.trigger({ element: h.button }).children("Edit"),
          model.open
            ? menu.positioner(h.div).children(
                menu.popup(h.div).children(
                  menu.item({ element: h.div, value: "copy" }).children("Copy"),
                  menu.item({ element: h.div, value: "paste" }).children("Paste"),
                  menu.checkboxItem({ element: h.div, value: "wrap" }).children("Wrap lines")
                )
              )
            : undefined
        )
    })
})

describe("@effect/ui-kit APG audit on HtmlPlay (TestHost, zero DOM)", () => {
  it("Switch passes APG switch pattern", () =>
    runPlay(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(SwitchDemo, {})
          yield* checkPattern(play, "switch")
        })
      )
    ))

  it("Checkbox passes APG checkbox pattern (Space toggles, Enter does not)", () =>
    runPlay(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(CheckboxDemo, {})
          yield* checkPattern(play, "checkbox")
        })
      )
    ))

  it("Collapsible passes APG disclosure pattern", () =>
    runPlay(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(CollapsibleDemo, {})
          yield* checkPattern(play, "disclosure")
        })
      )
    ))

  it("Accordion passes APG accordion pattern", () =>
    runPlay(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(AccordionDemo, {})
          yield* checkPattern(play, "accordion")
        })
      )
    ))

  it("Tabs passes APG tabs pattern in both LTR and RTL (horizontal) and vertical", () =>
    runPlay(
      Effect.gen(function*() {
        yield* checkDirection(
          (direction: Direction) => HtmlPlay.make(TabsDemo, { direction }),
          "tabs"
        )
        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(TabsDemo, {
              direction: "ltr",
              orientation: "vertical"
            })
            yield* checkPattern(play, "tabs")
          })
        )
      })
    ))

  it("RadioGroup passes APG radio-group pattern in both LTR and RTL", () =>
    runPlay(
      checkDirection(
        (direction: Direction) => HtmlPlay.make(RadioDemo, { direction }),
        "radio-group"
      )
    ))

  it("Toolbar passes APG toolbar pattern in both LTR and RTL and vertical", () =>
    runPlay(
      Effect.gen(function*() {
        yield* checkDirection(
          (direction: Direction) => HtmlPlay.make(ToolbarDemo, { direction }),
          "toolbar"
        )
        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(ToolbarDemo, {
              direction: "ltr",
              orientation: "vertical"
            })
            yield* checkPattern(play, "toolbar")
          })
        )
      })
    ))

  it("Slider passes APG slider pattern in both LTR and RTL and vertical", () =>
    runPlay(
      Effect.gen(function*() {
        yield* checkDirection(
          (direction: Direction) => HtmlPlay.make(SliderDemo, { direction }),
          "slider"
        )
        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(SliderDemo, {
              direction: "ltr",
              orientation: "vertical"
            })
            yield* checkPattern(play, "slider")
          })
        )
      })
    ))

  it("Dialog passes APG dialog pattern", () =>
    runPlay(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(DialogDemo, {})
          yield* checkPattern(play, "dialog")
        })
      )
    ))

  it("AlertDialog passes APG alertdialog pattern", () =>
    runPlay(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(AlertDialogDemo, {})
          yield* checkPattern(play, "alertdialog")
        })
      )
    ))

  it("Select passes APG combobox pattern", () =>
    runPlay(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(SelectDemo, {})
          yield* checkPattern(play, "combobox")
        })
      )
    ))

  it("Combobox passes APG combobox pattern", () =>
    runPlay(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(ComboboxDemo, {})
          yield* checkPattern(play, "combobox")
        })
      )
    ))

  it("Menu passes APG menu pattern", () =>
    runPlay(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(MenuDemo, {})
          yield* checkPattern(play, "menu")
        })
      )
    ))
})
