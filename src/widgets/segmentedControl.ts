import { UiSchema } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { resolveDir, safeIdToken } from "./internal.js"

export interface IndicatorRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface IndicatorGeometry {
  readonly offset: number
  readonly size: number
  readonly cssVars: Readonly<Record<string, string>>
}

/**
 * Computes sliding indicator geometry relative to its container for
 * `SegmentedControl`, `Tabs`, or `NavigationMenu`.
 */
export const computeIndicatorGeometry = (
  container: IndicatorRect,
  active: IndicatorRect,
  orientation: "horizontal" | "vertical" = "horizontal"
): IndicatorGeometry => {
  const offset =
    orientation === "horizontal"
      ? active.left - container.left
      : active.top - container.top
  const size = orientation === "horizontal" ? active.width : active.height
  return {
    offset,
    size,
    cssVars: {
      "--indicator-offset": `${offset}px`,
      "--indicator-size": `${size}px`
    }
  }
}

export const SegmentedOption = Schema.Struct({
  value: Schema.String,
  label: Schema.String,
  disabled: Schema.optional(Schema.Boolean)
})
export type SegmentedOption = typeof SegmentedOption.Type

export const SegmentedControlProps = Schema.Struct({
  label: Schema.String,
  options: Schema.Array(SegmentedOption),
  value: Schema.String,
  orientation: Schema.optional(Schema.Literals(["horizontal", "vertical"])),
  dir: Schema.optional(Schema.Literals(["ltr", "rtl"])),
  idPrefix: Schema.optional(Schema.String)
})
export type SegmentedControlProps = typeof SegmentedControlProps.Type

export const SegmentedControlEvents = UiSchema.TaggedEnum({
  ValueChanged: { value: Schema.String }
})
export type SegmentedControlEvents = typeof SegmentedControlEvents.Type

const SegmentedMsg = UiSchema.TaggedEnum({
  Selected: { value: Schema.String },
  FocusDone: {}
})

const segmentRef = (value: string) => Html.ref(`Segment[${value}]`, "button")

/**
 * Accessible WAI-ARIA `radiogroup` segmented control with roving tabindex,
 * RTL-aware Arrow navigation, and `HtmlCommand.focus`.
 */
export const SegmentedControl = Html.component({
  name: "SegmentedControl",
  props: SegmentedControlProps,
  model: Schema.Struct({}),
  message: SegmentedMsg,
  events: SegmentedControlEvents
}).make({
  init: () => ({}),
  update: {
    Selected: ($, { value }) =>
      $.emit(SegmentedControlEvents.ValueChanged({ value })).run(
        HtmlCommand.focus(segmentRef(value), () => SegmentedMsg.FocusDone())
      ),
    FocusDone: ($) => $.model
  },
  view: (h) => {
    const p = h.props
    const orientation = p.orientation ?? "horizontal"
    const prefix = p.idPrefix ?? "seg"
    const enabled = p.options.filter((o) => !o.disabled)
    const activeValue = enabled.some((o) => o.value === p.value)
      ? p.value
      : (enabled[0]?.value ?? "")

    return h.div
      .attrs({
        role: "radiogroup",
        "aria-label": p.label,
        "aria-orientation": orientation,
        ...(p.dir !== undefined ? { dir: p.dir } : {}),
        "data-segmented-control": ""
      })
      .children(
        ...p.options.map((opt) => {
          const checked = opt.value === p.value
          const isStop = !opt.disabled && opt.value === activeValue
          return h.button
            .key(opt.value)
            .ref(segmentRef(opt.value))
            .attrs({
              id: `${prefix}-${safeIdToken(opt.value)}`,
              type: "button",
              role: "radio",
              "aria-checked": String(checked),
              tabindex: opt.disabled ? "-1" : isStop ? "0" : "-1",
              ...(opt.disabled ? { "aria-disabled": "true", "data-disabled": "" } : {})
            })
            .on("click", () =>
              opt.disabled ? undefined : SegmentedMsg.Selected({ value: opt.value })
            )
            .on(
              "keydown",
              ({ key }) => {
                if (opt.disabled || enabled.length === 0) return undefined
                const idx = enabled.findIndex((o) => o.value === opt.value)
                if (idx === -1) return undefined

                const isRtl = resolveDir(p.dir) === "rtl"
                const nextKey =
                  orientation === "vertical"
                    ? "ArrowDown"
                    : isRtl
                    ? "ArrowLeft"
                    : "ArrowRight"
                const prevKey =
                  orientation === "vertical"
                    ? "ArrowUp"
                    : isRtl
                    ? "ArrowRight"
                    : "ArrowLeft"

                if (key === nextKey || (orientation === "horizontal" && key === "ArrowDown")) {
                  const next = enabled[(idx + 1) % enabled.length]!
                  return SegmentedMsg.Selected({ value: next.value })
                }
                if (key === prevKey || (orientation === "horizontal" && key === "ArrowUp")) {
                  const prev = enabled[(idx - 1 + enabled.length) % enabled.length]!
                  return SegmentedMsg.Selected({ value: prev.value })
                }
                if (key === "Home") {
                  return SegmentedMsg.Selected({ value: enabled[0]!.value })
                }
                if (key === "End") {
                  return SegmentedMsg.Selected({
                    value: enabled[enabled.length - 1]!.value
                  })
                }
                if (key === " " || key === "Enter") {
                  return SegmentedMsg.Selected({ value: opt.value })
                }
                return undefined
              },
              { preventDefault: true }
            )
            .children(opt.label)
        })
      )
  }
})
