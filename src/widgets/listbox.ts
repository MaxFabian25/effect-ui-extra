import { UiSchema } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { recoverFocusKey } from "./focusRecovery.js"
import { safeIdToken } from "./internal.js"

export const ListboxItem = Schema.Struct({
  value: Schema.String,
  label: Schema.String,
  disabled: Schema.optional(Schema.Boolean)
})
export type ListboxItem = typeof ListboxItem.Type

export const ListboxProps = Schema.Struct({
  label: Schema.String,
  items: Schema.Array(ListboxItem),
  selected: Schema.Array(Schema.String),
  selectionMode: Schema.optional(Schema.Literals(["single", "multiple"])),
  idPrefix: Schema.optional(Schema.String)
})
export type ListboxProps = typeof ListboxProps.Type

export const ListboxEvents = UiSchema.TaggedEnum({
  Selected: { values: Schema.Array(Schema.String) }
})
export type ListboxEvents = typeof ListboxEvents.Type

const ListboxMsg = UiSchema.TaggedEnum({
  FocusedOption: { value: Schema.String },
  ClickedOption: { value: Schema.String, shift: Schema.Boolean },
  MovedFocus: { value: Schema.String, selectRange: Schema.Boolean },
  ActivatedOption: { value: Schema.String },
  SelectedAll: {},
  FocusCommandDone: {}
})

const optionRef = (value: string) => Html.ref(`ListboxOption[${value}]`, "div")

/**
 * Computes a contiguous enabled range between `anchor` and `target` in `items`.
 */
export const computeListboxRange = (
  items: ReadonlyArray<ListboxItem>,
  anchor: string,
  target: string
): ReadonlyArray<string> => {
  const aIdx = items.findIndex((i) => i.value === anchor)
  const tIdx = items.findIndex((i) => i.value === target)
  if (aIdx === -1 || tIdx === -1) return [target]
  const lo = Math.min(aIdx, tIdx)
  const hi = Math.max(aIdx, tIdx)
  const out: Array<string> = []
  for (let i = lo; i <= hi; i++) {
    const item = items[i]!
    if (!item.disabled) out.push(item.value)
  }
  return out
}

const enabledValues = (items: ReadonlyArray<ListboxItem>): ReadonlyArray<string> =>
  items.filter((i) => !i.disabled).map((i) => i.value)

const resolveTabStop = (
  items: ReadonlyArray<ListboxItem>,
  focused: string | null,
  selected: ReadonlyArray<string>,
  previousOrder: ReadonlyArray<string>
): string | null => {
  const enabled = enabledValues(items)
  if (enabled.length === 0) return null
  if (focused !== null && enabled.includes(focused)) return focused
  if (focused !== null) {
    const recovered = recoverFocusKey({
      previousOrder,
      nextOrder: enabled,
      lostKey: focused
    })
    if (recovered !== undefined) return recovered
  }
  const firstSelected = selected.find((v) => enabled.includes(v))
  return firstSelected ?? enabled[0] ?? null
}

/**
 * Accessible standalone WAI-ARIA Listbox supporting single selection, multi
 * selection, `Shift+Click` / `Shift+Arrow` contiguous range selection,
 * `Ctrl/Meta+A` select-all, roving tabindex with `HtmlCommand.focus`, and
 * deterministic `FocusRecovery`.
 */
export const Listbox = Html.component({
  name: "Listbox",
  props: ListboxProps,
  model: Schema.Struct({
    focused: Schema.NullOr(Schema.String),
    anchor: Schema.NullOr(Schema.String),
    lastOrder: Schema.Array(Schema.String)
  }),
  message: ListboxMsg,
  events: ListboxEvents
}).make({
  init: ($) => {
    const order = [...enabledValues($.props.items)]
    const initial = resolveTabStop($.props.items, null, $.props.selected, order)
    return { focused: initial, anchor: initial, lastOrder: order }
  },
  update: {
    FocusedOption: ($, { value }) =>
      $.evolve({
        focused: value,
        anchor: $.model.anchor ?? value,
        lastOrder: [...enabledValues($.props.items)]
      }),
    ClickedOption: ($, { shift, value }) => {
      const item = $.props.items.find((i) => i.value === value)
      if (item === undefined || item.disabled) return $.model
      const mode = $.props.selectionMode ?? "single"
      let nextSelected: Array<string>
      let nextAnchor = $.model.anchor
      if (mode === "single") {
        nextSelected = [value]
        nextAnchor = value
      } else if (shift && $.model.anchor !== null) {
        nextSelected = [...computeListboxRange($.props.items, $.model.anchor, value)]
      } else {
        const has = $.props.selected.includes(value)
        nextSelected = has
          ? $.props.selected.filter((v) => v !== value)
          : [...$.props.selected, value]
        nextAnchor = value
      }
      return $.evolve({
        focused: value,
        anchor: nextAnchor,
        lastOrder: [...enabledValues($.props.items)]
      })
        .emit(ListboxEvents.Selected({ values: nextSelected }))
        .run(HtmlCommand.focus(optionRef(value), () => ListboxMsg.FocusCommandDone()))
    },
    MovedFocus: ($, { selectRange, value }) => {
      const mode = $.props.selectionMode ?? "single"
      const anchor = $.model.anchor ?? $.model.focused ?? value
      const next = $.evolve({
        focused: value,
        anchor: selectRange ? anchor : value,
        lastOrder: [...enabledValues($.props.items)]
      }).run(HtmlCommand.focus(optionRef(value), () => ListboxMsg.FocusCommandDone()))
      if (selectRange && mode === "multiple") {
        return next.emit(
          ListboxEvents.Selected({
            values: [...computeListboxRange($.props.items, anchor, value)]
          })
        )
      }
      return next
    },
    ActivatedOption: ($, { value }) => {
      const item = $.props.items.find((i) => i.value === value)
      if (item === undefined || item.disabled) return $.model
      const mode = $.props.selectionMode ?? "single"
      const nextSelected =
        mode === "single"
          ? [value]
          : $.props.selected.includes(value)
          ? $.props.selected.filter((v) => v !== value)
          : [...$.props.selected, value]
      return $.evolve({ anchor: value }).emit(
        ListboxEvents.Selected({ values: nextSelected })
      )
    },
    SelectedAll: ($) => {
      if (($.props.selectionMode ?? "single") !== "multiple") return $.model
      return $.emit(
        ListboxEvents.Selected({ values: [...enabledValues($.props.items)] })
      )
    },
    FocusCommandDone: ($) => $.model
  },
  view: (h, model) => {
    const p = h.props
    const mode = p.selectionMode ?? "single"
    const prefix = p.idPrefix ?? "listbox"
    const enabled = enabledValues(p.items)
    const activeTabStop = resolveTabStop(
      p.items,
      model.focused,
      p.selected,
      model.lastOrder
    )
    const selectedSet = new Set(p.selected)

    return h.div
      .attrs({
        role: "listbox",
        "aria-label": p.label,
        ...(mode === "multiple" ? { "aria-multiselectable": "true" } : {})
      })
      .children(
        ...p.items.map((item) => {
          const isSelected = selectedSet.has(item.value)
          const isStop = !item.disabled && activeTabStop === item.value
          return h.div
            .key(item.value)
            .ref(optionRef(item.value))
            .attrs({
              id: `${prefix}-opt-${safeIdToken(item.value)}`,
              role: "option",
              "aria-selected": String(isSelected),
              tabindex: item.disabled ? "-1" : isStop ? "0" : "-1",
              ...(item.disabled
                ? { "aria-disabled": "true", "data-disabled": "" }
                : {}),
              ...(isSelected ? { "data-selected": "" } : {})
            })
            .on("focus", () =>
              item.disabled ? undefined : ListboxMsg.FocusedOption({ value: item.value })
            )
            .on("click", ({ shift }) =>
              item.disabled
                ? undefined
                : ListboxMsg.ClickedOption({ value: item.value, shift })
            )
            .on(
              "keydown",
              ({ ctrl, key, meta, shift }) => {
                if (item.disabled) return undefined
                if ((ctrl || meta) && key.toLowerCase() === "a" && mode === "multiple") {
                  return ListboxMsg.SelectedAll()
                }
                const idx = enabled.indexOf(item.value)
                if (idx === -1) return undefined
                if (key === "ArrowDown") {
                  const next = enabled[Math.min(enabled.length - 1, idx + 1)]!
                  return ListboxMsg.MovedFocus({ value: next, selectRange: shift })
                }
                if (key === "ArrowUp") {
                  const prev = enabled[Math.max(0, idx - 1)]!
                  return ListboxMsg.MovedFocus({ value: prev, selectRange: shift })
                }
                if (key === "Home") {
                  return ListboxMsg.MovedFocus({
                    value: enabled[0]!,
                    selectRange: shift
                  })
                }
                if (key === "End") {
                  return ListboxMsg.MovedFocus({
                    value: enabled[enabled.length - 1]!,
                    selectRange: shift
                  })
                }
                if (key === " " || key === "Enter") {
                  return ListboxMsg.ActivatedOption({ value: item.value })
                }
                return undefined
              },
              { preventDefault: true }
            )
            .children(item.label)
        })
      )
  }
})
