import { UiSchema } from "@effect/ui"
import { Html, HtmlCommand, HtmlSubscription } from "@effect/ui/html"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { snapToStep } from "../direct/scale.js"
import { resolveDir } from "./internal.js"

export const AreaPointSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite
})
export type AreaPoint = typeof AreaPointSchema.Type

export const AreaPickerProps = Schema.Struct({
  label: Schema.String,
  xLabel: Schema.optional(Schema.String),
  yLabel: Schema.optional(Schema.String),
  value: Schema.optional(AreaPointSchema),
  minX: Schema.optional(Schema.Finite),
  maxX: Schema.optional(Schema.Finite),
  stepX: Schema.optional(Schema.Finite),
  minY: Schema.optional(Schema.Finite),
  maxY: Schema.optional(Schema.Finite),
  stepY: Schema.optional(Schema.Finite),
  dir: Schema.optional(Schema.Literals(["ltr", "rtl"])),
  disabled: Schema.optional(Schema.Boolean)
})
export type AreaPickerProps = typeof AreaPickerProps.Type

export const AreaPickerEvents = UiSchema.TaggedEnum({
  ValueChanged: { value: AreaPointSchema }
})
export type AreaPickerEvents = typeof AreaPickerEvents.Type

const AreaDragSchema = Schema.Struct({
  pointerId: Schema.Finite,
  left: Schema.Finite,
  top: Schema.Finite,
  width: Schema.Finite,
  height: Schema.Finite,
  pendingX: Schema.Finite,
  pendingY: Schema.Finite,
  isRtl: Schema.Boolean
})

const AreaPickerModel = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
  drag: Schema.NullOr(AreaDragSchema)
})

const AreaPickerMsg = UiSchema.TaggedEnum({
  Step: { dx: Schema.Finite, dy: Schema.Finite },
  Set: { x: Schema.Finite, y: Schema.Finite },
  PointerStart: { pointerId: Schema.Finite, x: Schema.Finite, y: Schema.Finite, isRtl: Schema.Boolean },
  AreaMeasured: {
    left: Schema.Finite,
    top: Schema.Finite,
    width: Schema.Finite,
    height: Schema.Finite
  },
  PointerMove: { pointerId: Schema.Finite, x: Schema.Finite, y: Schema.Finite },
  PointerEnd: { pointerId: Schema.optional(Schema.Finite) }
})

const areaRef = Html.ref("AreaPickerRoot", "div")

const clampPoint = (pt: AreaPoint, p: AreaPickerProps): AreaPoint => ({
  x: snapToStep(pt.x, p.minX ?? 0, p.maxX ?? 100, p.stepX ?? 1),
  y: snapToStep(pt.y, p.minY ?? 0, p.maxY ?? 100, p.stepY ?? 1)
})

const pointFromPointer = (
  px: number,
  py: number,
  bounds: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
  isRtl: boolean,
  p: AreaPickerProps
): AreaPoint => {
  const minX = p.minX ?? 0
  const maxX = p.maxX ?? 100
  const minY = p.minY ?? 0
  const maxY = p.maxY ?? 100
  const rawRx = Math.max(0, Math.min(1, (px - bounds.left) / bounds.width))
  const rx = isRtl ? 1 - rawRx : rawRx
  const ry = Math.max(0, Math.min(1, 1 - (py - bounds.top) / bounds.height))
  return clampPoint(
    {
      x: minX + rx * (maxX - minX),
      y: minY + ry * (maxY - minY)
    },
    p
  )
}

/**
 * Accessible 2D XY area picker (saturation/lightness pads, focal-point
 * selectors, equalizers) with pointer click/drag, Arrow, Shift+Arrow (10x),
 * PageUp/PageDown, and Home/End keyboard stepping, RTL horizontal reversal, and
 * two-axis ARIA text.
 */
export const AreaPicker = Html.component({
  name: "AreaPicker",
  props: AreaPickerProps,
  model: AreaPickerModel,
  message: AreaPickerMsg,
  events: AreaPickerEvents
}).make({
  init: ($) => {
    const pt = clampPoint(
      $.props.value ?? { x: $.props.minX ?? 0, y: $.props.minY ?? 0 },
      $.props
    )
    return { x: pt.x, y: pt.y, drag: null }
  },
  subscriptions: ($) =>
    $.model.drag === null
      ? []
      : [
          HtmlSubscription.onDocument("pointerup", ({ pointerId }) =>
            AreaPickerMsg.PointerEnd({ pointerId })
          ),
          HtmlSubscription.onDocument("pointercancel", ({ pointerId }) =>
            AreaPickerMsg.PointerEnd({ pointerId })
          ),
          HtmlSubscription.onWindow("blur", () => AreaPickerMsg.PointerEnd({}))
        ],
  update: {
    Step: ($, { dx, dy }) => {
      if ($.props.disabled) return $.model
      const cur = $.props.value ?? { x: $.model.x, y: $.model.y }
      const next = clampPoint({ x: cur.x + dx, y: cur.y + dy }, $.props)
      return $.evolve({ x: next.x, y: next.y }).emit(
        AreaPickerEvents.ValueChanged({ value: next })
      )
    },
    Set: ($, { x, y }) => {
      if ($.props.disabled) return $.model
      const next = clampPoint({ x, y }, $.props)
      return $.evolve({ x: next.x, y: next.y }).emit(
        AreaPickerEvents.ValueChanged({ value: next })
      )
    },
    PointerStart: ($, { isRtl, pointerId, x, y }) => {
      if ($.props.disabled) return $.model
      return $.evolve({
        drag: {
          pointerId,
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          pendingX: x,
          pendingY: y,
          isRtl
        }
      }).run(
        HtmlCommand.measure(areaRef, (rect) =>
          AreaPickerMsg.AreaMeasured(
            Option.isSome(rect)
              ? {
                  left: rect.value.x,
                  top: rect.value.y,
                  width: rect.value.width,
                  height: rect.value.height
                }
              : { left: 0, top: 0, width: 0, height: 0 }
          )
        )
      )
    },
    AreaMeasured: ($, { height, left, top, width }) => {
      const drag = $.model.drag
      if (drag === null || width <= 0 || height <= 0 || $.props.disabled) {
        return $.model
      }
      const next = pointFromPointer(
        drag.pendingX,
        drag.pendingY,
        { left, top, width, height },
        drag.isRtl,
        $.props
      )
      return $.evolve({
        x: next.x,
        y: next.y,
        drag: { ...drag, left, top, width, height }
      }).emit(AreaPickerEvents.ValueChanged({ value: next }))
    },
    PointerMove: ($, { pointerId, x, y }) => {
      const drag = $.model.drag
      if (drag === null || drag.pointerId !== pointerId || $.props.disabled) {
        return $.model
      }
      if (drag.width <= 0 || drag.height <= 0) {
        return $.evolve({ drag: { ...drag, pendingX: x, pendingY: y } })
      }
      const next = pointFromPointer(x, y, drag, drag.isRtl, $.props)
      return $.evolve({ x: next.x, y: next.y }).emit(
        AreaPickerEvents.ValueChanged({ value: next })
      )
    },
    PointerEnd: ($, { pointerId }) =>
      $.model.drag !== null &&
      (pointerId === undefined || $.model.drag.pointerId === pointerId)
        ? $.evolve({ drag: null })
        : $.model
  },
  view: (h, model) => {
    const p = h.props
    const minX = p.minX ?? 0
    const maxX = p.maxX ?? 100
    const stepX = p.stepX ?? 1
    const minY = p.minY ?? 0
    const maxY = p.maxY ?? 100
    const stepY = p.stepY ?? 1
    const pt = clampPoint(p.value ?? { x: model.x, y: model.y }, p)
    const xPct = maxX > minX ? ((pt.x - minX) / (maxX - minX)) * 100 : 0
    const yPct = maxY > minY ? ((pt.y - minY) / (maxY - minY)) * 100 : 0
    const xName = p.xLabel ?? "X"
    const yName = p.yLabel ?? "Y"

    return h.div
      .ref(areaRef)
      .attrs({
        "data-area-picker": "",
        ...(p.dir !== undefined ? { dir: p.dir } : {}),
        ...(model.drag !== null ? { "data-dragging": "true" } : {})
      })
      .on(
        "pointerdown",
        ({ button, pointerId, x, y }) =>
          !p.disabled && button === 0
            ? AreaPickerMsg.PointerStart({
                pointerId,
                x,
                y,
                isRtl: resolveDir(p.dir) === "rtl"
              })
            : undefined,
        { capturePointer: true, preventDefault: true }
      )
      .on("pointermove", ({ pointerId, x, y }) =>
        model.drag !== null && model.drag.pointerId === pointerId
          ? AreaPickerMsg.PointerMove({ pointerId, x, y })
          : undefined
      )
      .on("pointerup", ({ pointerId }) =>
        model.drag !== null && model.drag.pointerId === pointerId
          ? AreaPickerMsg.PointerEnd({ pointerId })
          : undefined
      )
      .on("pointercancel", ({ pointerId }) =>
        model.drag !== null && model.drag.pointerId === pointerId
          ? AreaPickerMsg.PointerEnd({ pointerId })
          : undefined
      )
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
            insetInlineStart: `${xPct}%`,
            bottom: `${yPct}%`
          })
          .on(
            "keydown",
            ({ key, shift }) => {
              if (p.disabled) return undefined
              const mult = shift ? 10 : 1
              const rightSign = resolveDir(p.dir) === "rtl" ? -1 : 1
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
