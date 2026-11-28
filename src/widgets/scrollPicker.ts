import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
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

const ScrollPickerMsg = UiSchema.TaggedEnum({
  SelectIndex: { index: Schema.Number }
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

/**
 * Accessible drum/wheel scroll picker (`role="listbox"` with
 * `aria-activedescendant`) paired with `projectScrollPickerIndex` for touch
 * momentum flick projection.
 */
export const ScrollPicker = Html.component({
  name: "ScrollPicker",
  props: ScrollPickerProps,
  model: Schema.Struct({ value: Schema.NullOr(Schema.String) }),
  message: ScrollPickerMsg,
  events: ScrollPickerEvents
}).make({
  init: ($) => ({
    value: $.props.value ?? $.props.options.find((o) => o.disabled !== true)?.value ?? null
  }),
  update: {
    SelectIndex: ($, { index }) => {
      const opt = $.props.options[index]
      if (opt === undefined || opt.disabled === true) return $.model
      return $.evolve({ value: opt.value }).emit(ScrollPickerEvents.ValueChanged({ value: opt.value }))
    }
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
        "data-active-index": String(activeIdx)
      })
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
            const target = Math.min(p.options.length - 1, activeIdx + 5)
            return ScrollPickerMsg.SelectIndex({ index: target })
          }
          if (key === "PageUp") {
            const target = Math.max(0, activeIdx - 5)
            return ScrollPickerMsg.SelectIndex({ index: target })
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
