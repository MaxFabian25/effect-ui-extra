import { UiSchema } from "@effect/ui"
import { Html, HtmlSubscription } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { projectDistance } from "../motion/kinematics.js"

export const ScrollPickerOptionSchema = Schema.Struct({
  value: Schema.String,
  label: Schema.String,
  disabled: Schema.optional(Schema.Boolean)
})
export type ScrollPickerOption = typeof ScrollPickerOptionSchema.Type

/**
 * Projects a flick release on a wheel/drum scroll picker using UIScrollView's
 * `0.998` per-ms deceleration rate and snaps to the nearest enabled option.
 */
export const projectScrollPickerIndex = (input: {
  readonly currentIndex: number
  readonly velocityItemsPerMs: number
  readonly options: ReadonlyArray<ScrollPickerOption>
  readonly decelerationRate?: number | undefined
}): number => {
  const { options } = input
  if (options.length === 0) return -1
  const rate = input.decelerationRate ?? 0.998
  const projectedDelta = projectDistance(input.velocityItemsPerMs * 1000, rate)
  const raw = Math.max(
    0,
    Math.min(options.length - 1, Math.round(input.currentIndex + projectedDelta))
  )
  if (options[raw]?.disabled !== true) return raw
  for (let offset = 1; offset < options.length; offset++) {
    if (raw + offset < options.length && options[raw + offset]?.disabled !== true) return raw + offset
    if (raw - offset >= 0 && options[raw - offset]?.disabled !== true) return raw - offset
  }
  return -1
}

export const ScrollPickerProps = Schema.Struct({
  label: Schema.String,
  options: Schema.Array(ScrollPickerOptionSchema),
  value: Schema.optional(Schema.String),
  idPrefix: Schema.optional(Schema.String)
})
export type ScrollPickerProps = typeof ScrollPickerProps.Type

export const ScrollPickerEvents = UiSchema.TaggedEnum({
  ValueChanged: { value: Schema.String }
})
export type ScrollPickerEvents = typeof ScrollPickerEvents.Type

const ScrollDragSchema = Schema.Struct({
  pointerId: Schema.Number,
  startY: Schema.Number,
  startIndex: Schema.Number
})

const ScrollPickerMsg = UiSchema.TaggedEnum({
  SelectIndex: { index: Schema.Number },
  DragStart: { pointerId: Schema.Number, y: Schema.Number, startIndex: Schema.Number },
  DragMove: { pointerId: Schema.Number, y: Schema.Number },
  DragEnd: { pointerId: Schema.optional(Schema.Number) }
})

const nextEnabledIndex = (
  options: ReadonlyArray<ScrollPickerOption>,
  from: number,
  step: 1 | -1
): number => {
  for (let i = from + step; i >= 0 && i < options.length; i += step) {
    if (options[i]?.disabled !== true) return i
  }
  return from
}

const jumpEnabledIndex = (
  options: ReadonlyArray<ScrollPickerOption>,
  from: number,
  delta: number
): number => {
  if (options.length === 0) return from
  const clamped = Math.max(0, Math.min(options.length - 1, from + delta))
  if (options[clamped]?.disabled !== true) return clamped
  const dir: 1 | -1 = delta >= 0 ? 1 : -1
  const forward = nextEnabledIndex(options, clamped, dir)
  if (forward !== clamped) return forward
  const backward = nextEnabledIndex(options, clamped, (dir * -1) as 1 | -1)
  return backward !== clamped ? backward : from
}

/**
 * Accessible drum/wheel scroll picker (`role="listbox"` with
 * `aria-activedescendant`) paired with `projectScrollPickerIndex` for touch
 * momentum flick projection and pointer drag.
 */
export const ScrollPicker = Html.component({
  name: "ScrollPicker",
  props: ScrollPickerProps,
  model: Schema.Struct({
    value: Schema.NullOr(Schema.String),
    drag: Schema.NullOr(ScrollDragSchema)
  }),
  message: ScrollPickerMsg,
  events: ScrollPickerEvents
}).make({
  init: ($) => ({
    value: $.props.value ?? $.props.options.find((o) => o.disabled !== true)?.value ?? null,
    drag: null
  }),
  subscriptions: ($) =>
    $.model.drag === null
      ? []
      : [
          HtmlSubscription.onDocument("pointerup", ({ pointerId }) =>
            ScrollPickerMsg.DragEnd({ pointerId })
          ),
          HtmlSubscription.onDocument("pointercancel", ({ pointerId }) =>
            ScrollPickerMsg.DragEnd({ pointerId })
          ),
          HtmlSubscription.onWindow("blur", () => ScrollPickerMsg.DragEnd({}))
        ],
  update: {
    SelectIndex: ($, { index }) => {
      const opt = $.props.options[index]
      if (opt === undefined || opt.disabled === true) return $.model
      return $.evolve({ value: opt.value }).emit(
        ScrollPickerEvents.ValueChanged({ value: opt.value })
      )
    },
    DragStart: ($, { pointerId, startIndex, y }) =>
      $.evolve({ drag: { pointerId, startY: y, startIndex } }),
    DragMove: ($, { pointerId, y }) => {
      const drag = $.model.drag
      if (drag === null || drag.pointerId !== pointerId) return $.model
      const dy = drag.startY - y
      if (Math.abs(dy) < 18) return $.model
      const deltaItems = Math.round(dy / 36)
      const targetIdx = jumpEnabledIndex($.props.options, drag.startIndex, deltaItems)
      const opt = $.props.options[targetIdx]
      if (opt === undefined || opt.disabled === true || opt.value === ($.props.value ?? $.model.value)) {
        return $.model
      }
      return $.evolve({ value: opt.value }).emit(
        ScrollPickerEvents.ValueChanged({ value: opt.value })
      )
    },
    DragEnd: ($, { pointerId }) =>
      $.model.drag !== null &&
      (pointerId === undefined || $.model.drag.pointerId === pointerId)
        ? $.evolve({ drag: null })
        : $.model
  },
  view: (h, model) => {
    const p = h.props
    const prefix = p.idPrefix ?? "scroll-picker"
    const activeVal = p.value ?? model.value
    const activeIdx = Math.max(
      0,
      p.options.findIndex((o) => o.value === activeVal)
    )
    const activeOpt = p.options[activeIdx]

    return h.div
      .attrs({
        role: "listbox",
        tabindex: "0",
        "aria-label": p.label,
        ...(activeOpt !== undefined ? { "aria-activedescendant": `${prefix}-opt-${activeIdx}` } : {}),
        "data-scroll-picker": "",
        "data-active-index": String(activeIdx),
        ...(model.drag !== null ? { "data-dragging": "true" } : {})
      })
      .on(
        "pointerdown",
        ({ button, pointerId, y }) =>
          button === 0
            ? ScrollPickerMsg.DragStart({ pointerId, y, startIndex: activeIdx })
            : undefined,
        { capturePointer: true }
      )
      .on("pointermove", ({ pointerId, y }) =>
        model.drag !== null && model.drag.pointerId === pointerId
          ? ScrollPickerMsg.DragMove({ pointerId, y })
          : undefined
      )
      .on("pointerup", ({ pointerId }) =>
        model.drag !== null && model.drag.pointerId === pointerId
          ? ScrollPickerMsg.DragEnd({ pointerId })
          : undefined
      )
      .on("pointercancel", ({ pointerId }) =>
        model.drag !== null && model.drag.pointerId === pointerId
          ? ScrollPickerMsg.DragEnd({ pointerId })
          : undefined
      )
      .on(
        "keydown",
        ({ key }) => {
          if (key === "ArrowDown") {
            return ScrollPickerMsg.SelectIndex({ index: nextEnabledIndex(p.options, activeIdx, 1) })
          }
          if (key === "ArrowUp") {
            return ScrollPickerMsg.SelectIndex({ index: nextEnabledIndex(p.options, activeIdx, -1) })
          }
          if (key === "PageDown") {
            return ScrollPickerMsg.SelectIndex({ index: jumpEnabledIndex(p.options, activeIdx, 5) })
          }
          if (key === "PageUp") {
            return ScrollPickerMsg.SelectIndex({ index: jumpEnabledIndex(p.options, activeIdx, -5) })
          }
          if (key === "Home") {
            const first = p.options.findIndex((o) => o.disabled !== true)
            return first >= 0 ? ScrollPickerMsg.SelectIndex({ index: first }) : undefined
          }
          if (key === "End") {
            for (let i = p.options.length - 1; i >= 0; i--) {
              if (p.options[i]?.disabled !== true) return ScrollPickerMsg.SelectIndex({ index: i })
            }
          }
          return undefined
        },
        { preventDefault: true }
      )
      .children(
        ...p.options.map((opt, idx) => {
          const selected = idx === activeIdx
          return h.div
            .key(opt.value)
            .attrs({
              id: `${prefix}-opt-${idx}`,
              role: "option",
              "aria-selected": String(selected),
              ...(opt.disabled === true ? { "aria-disabled": "true", "data-disabled": "" } : {}),
              ...(selected ? { "data-selected": "" } : {})
            })
            .on("click", () =>
              opt.disabled === true ? undefined : ScrollPickerMsg.SelectIndex({ index: idx })
            )
            .children(opt.label)
        })
      )
  }
})
