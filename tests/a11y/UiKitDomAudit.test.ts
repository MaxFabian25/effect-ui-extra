import { UiSchema } from '@effect/ui';
import type { Component } from '@effect/ui';
import {
  Accordion,
  AccordionItem,
  AlertDialog,
  Combobox,
  Dialog,
  DirectionProvider,
  Menu,
  Menubar,
  RadioGroup,
  Select,
  Slider,
  Tabs,
  Toolbar
} from "@effect/ui-kit"
import { BrowserHost, Html } from "@effect/ui/html"
import { afterAll, beforeAll, describe, it } from "bun:test"
import { Effect, Schema } from "effect"
import { GlobalWindow } from "happy-dom"
import { checkDirection, checkPattern } from '../../src/a11y/index.js';
import type { Direction } from '../../src/a11y/index.js';

let win: GlobalWindow | undefined
const savedGlobals = new Map<string, PropertyDescriptor | undefined>()

const domGlobalKeys = [
  "window",
  "document",
  "HTMLElement",
  "Element",
  "Node",
  "Document",
  "Text",
  "Comment",
  "DocumentFragment",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "FocusEvent",
  "InputEvent",
  "EventTarget",
  "DOMParser",
  "MutationObserver",
  "ResizeObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "navigator",
  "CSS"
] as const

beforeAll(() => {
  win = new GlobalWindow({ url: "http://localhost/" })
  for (const key of domGlobalKeys) {
    savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    const val: unknown = Reflect.get(win, key)
    if (val !== undefined) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value: val
      })
    }
  }
  if (typeof Reflect.get(globalThis, "ResizeObserver") === "undefined") {
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    })
  }
  // Minimal popover shim for happy-dom (matching @effect/ui-kit test utils)
  const showing = new Set<Element>()
  const origMatches: unknown = Reflect.get(win.Element.prototype, "matches")
  Reflect.set(win.HTMLElement.prototype, "showPopover", function(this: HTMLElement) {
    this.dispatchEvent(Object.assign(new Event("beforetoggle"), { newState: "open" }))
    showing.add(this)
    const field = this.localName === "dialog"
      ? ",input,button,select,textarea,a[href],[tabindex]:not([tabindex^='-'])"
      : ""
    this.querySelector<HTMLElement>("[autofocus]" + field)?.focus()
  })
  Reflect.set(win.HTMLElement.prototype, "hidePopover", function(this: HTMLElement) {
    showing.delete(this)
  })
  Reflect.set(win.Element.prototype, "matches", function(this: Element, selector: string) {
    return selector === ":popover-open"
      ? showing.has(this)
      : typeof origMatches === "function" && Boolean(Reflect.apply(origMatches, this, [selector]))
  })
  // Suppress WebKit false positive from happy-dom CSS.supports while preserving CSS.escape
  const origCss: unknown = Reflect.get(win, "CSS")
  const escapeFn: unknown =
    typeof origCss === "object" && origCss !== null ? Reflect.get(origCss, "escape") : undefined
  Object.defineProperty(globalThis, "CSS", {
    configurable: true,
    writable: true,
    value: {
      supports: () => false,
      escape:
        typeof escapeFn === "function"
          ? (value: string) => String(Reflect.apply(escapeFn, origCss, [value]))
          : (value: string) => value.replace(/([^\w-])/g, "\\$1")
    }
  })
})

afterAll(async () => {
  if (win !== undefined) {
    await win.happyDOM.close()
  }
  for (const [key, desc] of savedGlobals) {
    if (desc === undefined) {
      Reflect.deleteProperty(globalThis, key)
    } else {
      Object.defineProperty(globalThis, key, desc)
    }
  }
})

const tick = Effect.promise(
  () =>
    new Promise<void>((r) => {
      setTimeout(r, 40)
    })
)

const mountDom = <Props, Model, Msg, Events>(
  component: Component.Members<
    string,
    Props,
    Model,
    Msg,
    Events,
    never,
    Html.Elements,
    any,
    never
  >,
  props: Props
) =>
  Effect.gen(function*() {
    const container = yield* Effect.acquireRelease(
      Effect.sync(() => {
        const div = document.createElement("div")
        document.body.appendChild(div)
        return div
      }),
      (el) => Effect.sync(() => el.remove())
    )
    yield* BrowserHost.mountEffect(component, props, container)
    yield* tick
    return { container, settle: tick }
  })

const DialogMsg = UiSchema.TaggedEnum({ Opened: {}, Closed: {} })
const DialogDomDemo = Html.component({
  name: "DialogDomDemo",
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
          d.trigger(h.button).children("Open dialog"),
          d.portal(h.dialog)?.children(
            d.backdrop(h.div),
            d.viewport(h.div).children(
              d.popup(h.div).children(
                d.title(h.h2).children("Workspace settings"),
                d.description(h.p).children("Manage project preferences."),
                d.close(h.button).children("Close")
              )
            )
          )
        )
    })
})

const AlertDialogDomDemo = Html.component({
  name: "AlertDialogDomDemo",
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
          d.trigger(h.button).children("Delete item"),
          d.portal(h.dialog)?.children(
            d.backdrop(h.div),
            d.viewport(h.div).children(
              d.popup(h.div).children(
                d.title(h.h2).children("Delete item?"),
                d.description(h.p).children("This cannot be undone."),
                d.close(h.button).children("Cancel")
              )
            )
          )
        )
    })
})

const TabsMsg = UiSchema.TaggedEnum({ Selected: { value: Schema.String } })
const TabsDomDemo = Html.component({
  name: "TabsDomDemo",
  props: Schema.Struct({ direction: Schema.Literals(["ltr", "rtl"]) }),
  model: Schema.String,
  message: TabsMsg
}).make({
  init: () => "a",
  update: { Selected: (_, { value }) => value },
  view: (h, tab) =>
    DirectionProvider(h, {
      props: { direction: h.props.direction },
      view: () =>
        Tabs(h, {
          props: {
            value: tab,
            tabs: [{ value: "a" }, { value: "b" }, { value: "c" }]
          },
          onEmit: { Selected: ({ value }) => TabsMsg.Selected({ value }) },
          view: (tabs) =>
            tabs.root(h.div).children(
              tabs.list(h.div).children(
                tabs.tab({ element: h.button, value: "a" }).children("Alpha"),
                tabs.tab({ element: h.button, value: "b" }).children("Beta"),
                tabs.tab({ element: h.button, value: "c" }).children("Gamma")
              ),
              tabs.panel({ element: h.div, value: "a" })?.children("A"),
              tabs.panel({ element: h.div, value: "b" })?.children("B"),
              tabs.panel({ element: h.div, value: "c" })?.children("C")
            )
        })
    })
})

const RadioMsg = UiSchema.TaggedEnum({ Picked: { value: Schema.String } })
const RadioDomDemo = Html.component({
  name: "RadioDomDemo",
  props: Schema.Struct({ direction: Schema.Literals(["ltr", "rtl"]) }),
  model: Schema.String,
  message: RadioMsg
}).make({
  init: () => "a",
  update: { Picked: (_, { value }) => value },
  view: (h, value) =>
    DirectionProvider(h, {
      props: { direction: h.props.direction },
      view: () =>
        RadioGroup(h, {
          props: {
            value,
            items: [{ value: "a" }, { value: "b" }, { value: "c" }]
          },
          onEmit: { Picked: ({ value: next }) => RadioMsg.Picked({ value: next }) },
          view: (rg) =>
            rg.root(h.div.attr("aria-label", "Size")).children(
              rg.radio({ element: h.button.attr("aria-label", "Small"), value: "a" }),
              rg.radio({ element: h.button.attr("aria-label", "Medium"), value: "b" }),
              rg.radio({ element: h.button.attr("aria-label", "Large"), value: "c" })
            )
        })
    })
})

const ToolbarDomDemo = Html.component({
  name: "ToolbarDomDemo",
  props: Schema.Struct({ direction: Schema.Literals(["ltr", "rtl"]) }),
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
          props: { items: [{ value: "cut" }, { value: "copy" }, { value: "paste" }] },
          view: (tb) =>
            tb.root(h.div.attr("aria-label", "Clipboard")).children(
              tb.button({ element: h.button, value: "cut" }).children("Cut"),
              tb.button({ element: h.button, value: "copy" }).children("Copy"),
              tb.button({ element: h.button, value: "paste" }).children("Paste")
            )
        })
    })
})

const SliderMsg = UiSchema.TaggedEnum({ Moved: { value: Schema.Finite } })
const SliderDomDemo = Html.component({
  name: "SliderDomDemo",
  props: Schema.Struct({ direction: Schema.Literals(["ltr", "rtl"]) }),
  model: Schema.Finite,
  message: SliderMsg
}).make({
  init: () => 40,
  update: { Moved: (_, { value }) => value },
  view: (h, value) =>
    DirectionProvider(h, {
      props: { direction: h.props.direction },
      view: () =>
        Slider(h, {
          props: { value, min: 0, max: 100, step: 10 },
          onEmit: {
            Moved: ({ value: next }) => {
              const first: unknown = Array.isArray(next) ? next[0] : next
              return SliderMsg.Moved({ value: typeof first === "number" ? first : 0 })
            },
            Committed: () => undefined
          },
          view: (sl) =>
            sl.root(h.div).children(
              sl.control(h.div).children(
                sl.track(h.div).children(
                  sl.indicator(h.div),
                  sl.thumb({
                    element: h.div,
                    input: h.input.attr("aria-label", "Brightness")
                  })
                )
              )
            )
        })
    })
})

const MenubarMsg = UiSchema.TaggedEnum({
  Opened: { menu: Schema.String },
  Closed: { menu: Schema.String }
})
const MenubarDomDemo = Html.component({
  name: "MenubarDomDemo",
  props: Schema.Struct({ direction: Schema.Literals(["ltr", "rtl"]) }),
  model: Schema.NullOr(Schema.String),
  message: MenubarMsg
}).make({
  init: () => null,
  update: {
    Opened: (_, { menu }) => menu,
    Closed: ($, { menu }) => ($.model === menu ? null : $.model)
  },
  view: (h, openMenu) =>
    DirectionProvider(h, {
      props: { direction: h.props.direction },
      view: () =>
        Menubar(h, {
          props: { orientation: "horizontal" },
          view: (bar) =>
            bar.root(h.div).children(
              ...([
                ["file", [{ value: "new", label: "New" }, { value: "open", label: "Open" }]],
                ["edit", [{ value: "copy", label: "Copy" }, { value: "paste", label: "Paste" }]],
                ["view", [{ value: "zoom", label: "Zoom" }]]
              ] as const).map(([name, items]) =>
                Menu(h, {
                  key: name,
                  props: { open: openMenu === name, items: [...items] },
                  onEmit: {
                    RequestedOpen: () => MenubarMsg.Opened({ menu: name }),
                    RequestedClose: () => MenubarMsg.Closed({ menu: name }),
                    Picked: () => undefined,
                    Highlighted: () => undefined,
                    RequestedQuery: () => undefined,
                    Settled: () => undefined
                  },
                  view: (menu) =>
                    h.div(
                      menu.trigger({ element: h.button }).children(name),
                      menu.positioner(h.div).children(
                        menu.popup(h.div).children(
                          ...items.map((item) =>
                            menu.item({ element: h.div, value: item.value }).children(item.label)
                          )
                        )
                      )
                    )
                })
              )
            )
        })
    })
})

const SelectDomMsg = UiSchema.TaggedEnum({
  Opened: {},
  Closed: {},
  Picked: { value: Schema.String }
})
const selectDomItems = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" }
]
const SelectDomDemo = Html.component({
  name: "SelectDomDemo",
  model: Schema.Struct({ open: Schema.Boolean, value: Schema.String }),
  message: SelectDomMsg
}).make({
  init: () => ({ open: false, value: "light" }),
  update: {
    Opened: ($) => $.evolve({ open: true }),
    Closed: ($) => $.evolve({ open: false }),
    Picked: ($, { value }) => $.evolve({ value })
  },
  view: (h, model) =>
    Select(h, {
      props: { open: model.open, value: model.value, items: selectDomItems },
      onEmit: {
        RequestedOpen: () => SelectDomMsg.Opened(),
        RequestedClose: () => SelectDomMsg.Closed(),
        Picked: ({ value }) => SelectDomMsg.Picked({ value: String(value) }),
        Settled: () => undefined
      },
      view: (sel) =>
        h.div(
          sel.label(h.div).children("Theme"),
          sel.trigger(h.button).children(sel.value(h.span)),
          sel.positioner(h.div).children(
            sel.popup(h.div).children(
              ...selectDomItems.map(({ label, value }) =>
                sel.item({ element: h.div, value }).children(
                  sel.itemText(h.div).children(label)
                )
              )
            )
          )
        )
    })
})

const ComboDomMsg = UiSchema.TaggedEnum({
  Opened: {},
  Closed: {},
  Picked: { value: Schema.NullOr(Schema.String) },
  Typed: { inputValue: Schema.String }
})
const comboDomItems = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" }
]
const ComboboxDomDemo = Html.component({
  name: "ComboboxDomDemo",
  model: Schema.Struct({
    open: Schema.Boolean,
    value: Schema.NullOr(Schema.String),
    inputValue: Schema.String
  }),
  message: ComboDomMsg
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
        items: comboDomItems
      },
      onEmit: {
        RequestedOpen: () => ComboDomMsg.Opened(),
        RequestedClose: () => ComboDomMsg.Closed(),
        Picked: ({ value }) => {
          const picked: unknown = Array.isArray(value) ? value[0] : value
          return ComboDomMsg.Picked({ value: typeof picked === "string" ? picked : null })
        },
        RequestedInputValue: ({ inputValue }) => ComboDomMsg.Typed({ inputValue }),
        Highlighted: () => undefined,
        Settled: () => undefined
      },
      view: (cb) =>
        h.div(
          cb.inputGroup(h.div).children(
            cb.input(h.input.attr("aria-label", "Fruit")),
            cb.trigger(h.button.attr("aria-label", "Open fruits")).children("v")
          ),
          cb.positioner(h.div).children(
            cb.popup(h.div).children(
              cb.list(h.div).children(
                ...cb.items.map(({ label, value }) =>
                  cb.item({ element: h.div, value }).children(label)
                )
              )
            )
          )
        )
    })
})

const MenuDomMsg = UiSchema.TaggedEnum({ Opened: {}, Closed: {} })
const MenuDomDemo = Html.component({
  name: "MenuDomDemo",
  model: Schema.Boolean,
  message: MenuDomMsg
}).make({
  init: () => false,
  update: { Opened: () => true, Closed: () => false },
  view: (h, open) =>
    Menu(h, {
      props: {
        open,
        items: [
          { value: "copy", label: "Copy" },
          { value: "paste", label: "Paste" },
          { value: "wrap", label: "Wrap lines", checked: true }
        ]
      },
      onEmit: {
        RequestedOpen: () => MenuDomMsg.Opened(),
        RequestedClose: () => MenuDomMsg.Closed(),
        Picked: () => undefined,
        Highlighted: () => undefined,
        RequestedQuery: () => undefined,
        Settled: () => undefined
      },
      view: (menu) =>
        h.div(
          menu.trigger({ element: h.button }).children("Edit"),
          menu.positioner(h.div).children(
            menu.popup(h.div).children(
              menu.item({ element: h.div, value: "copy" }).children("Copy"),
              menu.item({ element: h.div, value: "paste" }).children("Paste"),
              menu.checkboxItem({ element: h.div, value: "wrap" }).children("Wrap lines")
            )
          )
        )
    })
})

const AccordionDomMsg = UiSchema.TaggedEnum({
  Toggled: { value: Schema.Array(Schema.String) }
})
const AccordionDomDemo = Html.component({
  name: "AccordionDomDemo",
  model: Schema.Array(Schema.String),
  message: AccordionDomMsg
}).make({
  init: () => ["a"],
  update: { Toggled: (_, { value }) => value },
  view: (h, open) =>
    Accordion(h, {
      props: { value: open },
      onEmit: { Toggled: ({ value }) => AccordionDomMsg.Toggled({ value }) },
      view: (acc) =>
        acc.root(h.div).children(
          ...([
            ["a", "First", "First answer"],
            ["b", "Second", "Second answer"]
          ] as const).map(([value, title, body]) =>
            AccordionItem(h, {
              key: value,
              props: { value },
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

describe("@effect/ui-kit APG audit on BrowserHost (happy-dom, full onMount + activeElement)", () => {
  it("Dialog passes APG dialog pattern including Escape dismissal", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const target = yield* mountDom(DialogDomDemo, {})
          yield* checkPattern(target, "dialog")
        })
      )
    ))

  it("AlertDialog passes APG alertdialog pattern including Escape dismissal", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const target = yield* mountDom(AlertDialogDomDemo, {})
          yield* checkPattern(target, "alertdialog")
        })
      )
    ))

  it("Tabs passes checkDirection in real DOM", () =>
    Effect.runPromise(
      checkDirection(
        (direction: Direction) => mountDom(TabsDomDemo, { direction }),
        "tabs"
      )
    ))

  it("RadioGroup passes checkDirection in real DOM", () =>
    Effect.runPromise(
      checkDirection(
        (direction: Direction) => mountDom(RadioDomDemo, { direction }),
        "radio-group"
      )
    ))

  it("Toolbar passes checkDirection in real DOM", () =>
    Effect.runPromise(
      checkDirection(
        (direction: Direction) => mountDom(ToolbarDomDemo, { direction }),
        "toolbar"
      )
    ))

  it("Slider passes checkDirection in real DOM", () =>
    Effect.runPromise(
      checkDirection(
        (direction: Direction) => mountDom(SliderDomDemo, { direction }),
        "slider"
      )
    ))

  it("Menubar passes checkDirection in real DOM", () =>
    Effect.runPromise(
      checkDirection(
        (direction: Direction) => mountDom(MenubarDomDemo, { direction }),
        "menubar"
      )
    ))

  it("Select passes APG combobox pattern in real DOM", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const target = yield* mountDom(SelectDomDemo, {})
          yield* checkPattern(target, "combobox")
        })
      )
    ))

  it("Combobox passes APG combobox pattern in real DOM", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const target = yield* mountDom(ComboboxDomDemo, {})
          yield* checkPattern(target, "combobox")
        })
      )
    ))

  it("Menu passes APG menu pattern in real DOM", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const target = yield* mountDom(MenuDomDemo, {})
          yield* checkPattern(target, "menu")
        })
      )
    ))

  it("Accordion passes APG accordion pattern in real DOM", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const target = yield* mountDom(AccordionDomDemo, {})
          yield* checkPattern(target, "accordion")
        })
      )
    ))
})
