import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { snapToStep } from "../direct/scale.js"

export const AreaPointSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number
})
export type AreaPoint = typeof AreaPointSchema.Type

export const AreaPickerProps = Schema.Struct({
  label: Schema.String,
  xLabel: Schema.optional(Schema.String),
  yLabel: Schema.optional(Schema.String),
  value: Schema.optional(AreaPointSchema),
  minX: Schema.optional(Schema.Number),
  maxX: Schema.optional(Schema.Number),
  stepX: Schema.optional(Schema.Number),
  minY: Schema.optional(Schema.Number),
  maxY: Schema.optional(Schema.Number),
  stepY: Schema.optional(Schema.Number),
  dir: Schema.optional(Schema.Literals(["ltr", "rtl"])),
  disabled: Schema.optional(Schema.Boolean)
})
export type AreaPickerProps = typeof AreaPickerProps.Type

export const AreaPickerEvents = UiSchema.TaggedEnum({
  ValueChanged: { value: AreaPointSchema }
})
export type AreaPickerEvents = typeof AreaPickerEvents.Type

const AreaPickerMsg = UiSchema.TaggedEnum({
  Step: { dx: Schema.Number, dy: Schema.Number },
  Set: { x: Schema.Number, y: Schema.Number }
})

const clampPoint = (pt: AreaPoint, p: AreaPickerProps): AreaPoint => ({
  x: snapToStep(pt.x, p.minX ?? 0, p.maxX ?? 100, p.stepX ?? 1),
  y: snapToStep(pt.y, p.minY ?? 0, p.maxY ?? 100, p.stepY ?? 1)
})

/**
 * Accessible 2D XY area picker (saturation/lightness pads, focal-point
 * selectors, equalizers) with Arrow, Shift+Arrow (10x), PageUp/PageDown, and
 * Home/End keyboard stepping, RTL horizontal reversal, and two-axis ARIA text.
 */
export const AreaPicker = Html.component({
  name: "AreaPicker",
  props: AreaPickerProps,
  model: AreaPointSchema,
  message: AreaPickerMsg,
  events: AreaPickerEvents
}).make({
  init: ($) => clampPoint($.props.value ?? { x: $.props.minX ?? 0, y: $.props.minY ?? 0 }, $.props),
  update: {
    Step: ($, { dx, dy }) => {
      if ($.props.disabled) return $.model
      const cur = $.props.value ?? $.model
      const next = clampPoint({ x: cur.x + dx, y: cur.y + dy }, $.props)
      return $.evolve(next).emit(AreaPickerEvents.ValueChanged({ value: next }))
    },
    Set: ($, { x, y }) => {
      if ($.props.disabled) return $.model
      const next = clampPoint({ x, y }, $.props)
      return $.evolve(next).emit(AreaPickerEvents.ValueChanged({ value: next }))
    }
  },
  view: (h, model) => {
    const p = h.props
    const minX = p.minX ?? 0
    const maxX = p.maxX ?? 100
    const stepX = p.stepX ?? 1
    const minY = p.minY ?? 0
    const maxY = p.maxY ?? 100
    const stepY = p.stepY ?? 1
    const isRtl = p.dir === "rtl"
    const pt = clampPoint(p.value ?? model, p)
    const xPct = maxX > minX ? ((pt.x - minX) / (maxX - minX)) * 100 : 0
    const yPct = maxY > minY ? ((pt.y - minY) / (maxY - minY)) * 100 : 0
    const xName = p.xLabel ?? "X"
    const yName = p.yLabel ?? "Y"

    return h.div
      .attrs({
        "data-area-picker": "",
        dir: p.dir
      })
      .children(
        h.div
          .attrs({
            role: "slider",
            tabindex: p.disabled ? "-1" : "0",
            "aria-label": p.label,
            "aria-valuemin": String(minX),
            "aria-valuemax": String(maxX),
            "aria-valuenow": String(pt.x),
            "aria-valuetext": `${xName} ${pt.x}, ${yName} ${pt.y}`,
            "data-x": String(pt.x),
            "data-y": String(pt.y),
            ...(p.disabled ? { "aria-disabled": "true", "data-disabled": "" } : {})
          })
          .style({
            left: `${isRtl ? 100 - xPct : xPct}%`,
            bottom: `${yPct}%`
          })
          .on(
            "keydown",
            ({ key, shift }) => {
              if (p.disabled) return undefined
              const mult = shift ? 10 : 1
              const rightSign = isRtl ? -1 : 1
              if (key === "ArrowRight") return AreaPickerMsg.Step({ dx: stepX * mult * rightSign, dy: 0 })
              if (key === "ArrowLeft") return AreaPickerMsg.Step({ dx: -stepX * mult * rightSign, dy: 0 })
              if (key === "ArrowUp") return AreaPickerMsg.Step({ dx: 0, dy: stepY * mult })
              if (key === "ArrowDown") return AreaPickerMsg.Step({ dx: 0, dy: -stepY * mult })
              if (key === "PageUp") return AreaPickerMsg.Step({ dx: 0, dy: stepY * 10 })
              if (key === "PageDown") return AreaPickerMsg.Step({ dx: 0, dy: -stepY * 10 })
              if (key === "Home") return AreaPickerMsg.Set({ x: minX, y: pt.y })
              if (key === "End") return AreaPickerMsg.Set({ x: maxX, y: pt.y })
              return undefined
            },
            { preventDefault: true }
          )
      )
  }
})
