import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import {
  clampToGamut,
  formatHex,
  formatOklch,
  parseColor,
  wcagContrast
} from "../theme/index.js"

export const ColorPickerProps = Schema.Struct({
  label: Schema.String,
  value: Schema.String,
  contrastAgainst: Schema.optional(Schema.String),
  gamut: Schema.optional(Schema.Literals(["srgb", "p3"])),
  idPrefix: Schema.optional(Schema.String)
})
export type ColorPickerProps = typeof ColorPickerProps.Type

export const ColorPickerEvents = UiSchema.TaggedEnum({
  ValueChanged: { oklch: Schema.String, hex: Schema.String }
})
export type ColorPickerEvents = typeof ColorPickerEvents.Type

const ColorPickerMsg = UiSchema.TaggedEnum({
  ChannelChanged: {
    channel: Schema.Literals(["l", "c", "h"]),
    value: Schema.Number
  },
  TextCommitted: { raw: Schema.String }
})

/**
 * Accessible OKLCH ColorPicker built directly on `effect-ui-theme`, with
 * hue-preserving gamut clamping, hex/OKLCH text input, and optional live WCAG
 * 2.1 contrast ratio readout against a background token.
 */
export const ColorPicker = Html.component({
  name: "ColorPicker",
  props: ColorPickerProps,
  model: Schema.Struct({}),
  message: ColorPickerMsg,
  events: ColorPickerEvents
}).make({
  init: () => ({}),
  update: {
    ChannelChanged: ($, { channel, value }) => {
      const base = parseColor($.props.value) ?? { l: 0.5, c: 0.14, h: 260, alpha: 1 }
      const updated = clampToGamut(
        {
          ...base,
          [channel]: value
        },
        $.props.gamut ?? "srgb"
      )
      return $.emit(
        ColorPickerEvents.ValueChanged({
          oklch: formatOklch(updated),
          hex: formatHex(updated)
        })
      )
    },
    TextCommitted: ($, { raw }) => {
      const parsed = parseColor(raw)
      if (parsed === undefined) return $.model
      const clamped = clampToGamut(parsed, $.props.gamut ?? "srgb")
      return $.emit(
        ColorPickerEvents.ValueChanged({
          oklch: formatOklch(clamped),
          hex: formatHex(clamped)
        })
      )
    }
  },
  view: (h) => {
    const p = h.props
    const prefix = p.idPrefix ?? "color"
    const parsed = clampToGamut(
      parseColor(p.value) ?? { l: 0.5, c: 0.14, h: 260, alpha: 1 },
      p.gamut ?? "srgb"
    )
    const hex = formatHex(parsed)
    const contrast =
      p.contrastAgainst !== undefined
        ? wcagContrast(parsed, p.contrastAgainst)
        : undefined

    const slider = (
      channel: "l" | "c" | "h",
      name: string,
      value: number,
      min: number,
      max: number,
      step: number
    ) => {
      const rounded = Math.round(value * 1000) / 1000
      return h.input
        .key(channel)
        .attrs({
          id: `${prefix}-${channel}`,
          type: "range",
          role: "slider",
          min: String(min),
          max: String(max),
          step: String(step),
          "aria-label": `${p.label} ${name}`,
          "aria-valuemin": String(min),
          "aria-valuemax": String(max),
          "aria-valuenow": String(rounded)
        })
        .value(String(rounded))
        .on("input", ({ value: raw }) => {
          const parsedNum = Number(raw)
          return Number.isFinite(parsedNum)
            ? ColorPickerMsg.ChannelChanged({
                channel,
                value: Math.min(max, Math.max(min, parsedNum))
              })
            : undefined
        })
        .on(
          "keydown",
          ({ key }) => {
            if (key === "ArrowRight" || key === "ArrowUp") {
              return ColorPickerMsg.ChannelChanged({
                channel,
                value: Math.min(max, value + step)
              })
            }
            if (key === "ArrowLeft" || key === "ArrowDown") {
              return ColorPickerMsg.ChannelChanged({
                channel,
                value: Math.max(min, value - step)
              })
            }
            if (key === "Home") {
              return ColorPickerMsg.ChannelChanged({ channel, value: min })
            }
            if (key === "End") {
              return ColorPickerMsg.ChannelChanged({ channel, value: max })
            }
            return undefined
          },
          { preventDefault: true }
        )
    }

    return h.div
      .attrs({ role: "group", "aria-label": p.label, "data-color-picker": "" })
      .children(
        slider("l", "Lightness", parsed.l, 0, 1, 0.05),
        slider("c", "Chroma", parsed.c, 0, 0.37, 0.01),
        slider("h", "Hue", parsed.h, 0, 359, 5),
        h.input
          .attrs({
            id: `${prefix}-hex`,
            type: "text",
            "aria-label": `${p.label} hex value`
          })
          .value(hex)
          .on("input", ({ value }) => ColorPickerMsg.TextCommitted({ raw: value })),
        contrast !== undefined
          ? h.output
              .attrs({ "data-contrast-ratio": String(contrast) })
              .children(`${contrast}:1`)
          : undefined
      )
  }
})
