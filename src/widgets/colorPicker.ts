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
import { resolveDir } from "./internal.js"

export const ColorPickerProps = Schema.Struct({
  label: Schema.String,
  value: Schema.String,
  contrastAgainst: Schema.optional(Schema.String),
  gamut: Schema.optional(Schema.Literals(["srgb", "p3"])),
  dir: Schema.optional(Schema.Literals(["ltr", "rtl"])),
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
    value: Schema.Finite
  },
  DraftEdited: { raw: Schema.String },
  DraftCommitted: {},
  DraftReverted: {}
})

const isFullColorLiteral = (raw: string): boolean => {
  const trimmed = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return true
  if (/^(?:oklch|rgba?)\(.+\)$/i.test(trimmed)) return true
  return false
}

/**
 * Accessible OKLCH ColorPicker built directly on `effect-ui-theme`, with
 * hue-preserving gamut clamping, live swatch preview, non-blocking hex/OKLCH
 * draft editing, and optional live WCAG 2.1 contrast ratio readout.
 */
export const ColorPicker = Html.component({
  name: "ColorPicker",
  props: ColorPickerProps,
  model: Schema.Struct({
    draft: Schema.NullOr(Schema.String)
  }),
  message: ColorPickerMsg,
  events: ColorPickerEvents
}).make({
  init: () => ({ draft: null }),
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
      return $.evolve({ draft: null }).emit(
        ColorPickerEvents.ValueChanged({
          oklch: formatOklch(updated),
          hex: formatHex(updated)
        })
      )
    },
    DraftEdited: ($, { raw }) => {
      if (isFullColorLiteral(raw)) {
        const parsed = parseColor(raw)
        if (parsed !== undefined) {
          const clamped = clampToGamut(parsed, $.props.gamut ?? "srgb")
          return $.evolve({ draft: null }).emit(
            ColorPickerEvents.ValueChanged({
              oklch: formatOklch(clamped),
              hex: formatHex(clamped)
            })
          )
        }
      }
      return $.evolve({ draft: raw })
    },
    DraftCommitted: ($) => {
      if ($.model.draft === null) return $.model
      const parsed = parseColor($.model.draft)
      if (parsed === undefined) return $.model
      const clamped = clampToGamut(parsed, $.props.gamut ?? "srgb")
      return $.evolve({ draft: null }).emit(
        ColorPickerEvents.ValueChanged({
          oklch: formatOklch(clamped),
          hex: formatHex(clamped)
        })
      )
    },
    DraftReverted: ($) => $.evolve({ draft: null })
  },
  view: (h, model) => {
    const p = h.props
    const prefix = p.idPrefix ?? "color"
    const parsed = clampToGamut(
      parseColor(p.value) ?? { l: 0.5, c: 0.14, h: 260, alpha: 1 },
      p.gamut ?? "srgb"
    )
    const hex = formatHex(parsed)
    const displayText = model.draft ?? hex
    const isInvalid = model.draft !== null && parseColor(model.draft) === undefined
    const contrast =
      p.contrastAgainst !== undefined
        ? wcagContrast(parsed, p.contrastAgainst)
        : undefined

    const slider = (
      channel: "l" | "c" | "h",
      shortLabel: string,
      name: string,
      value: number,
      min: number,
      max: number,
      step: number
    ) => {
      const rounded = Math.round(value * 1000) / 1000
      const id = `${prefix}-${channel}`
      return h.label
        .key(channel)
        .attrs({ for: id, "data-color-channel": channel })
        .children(
          h.span.attrs({ "aria-hidden": "true" }).children(shortLabel),
          h.input
            .attrs({
              id,
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
                const isRtl = resolveDir(p.dir) === "rtl"
                const incKey = isRtl ? "ArrowLeft" : "ArrowRight"
                const decKey = isRtl ? "ArrowRight" : "ArrowLeft"
                if (key === incKey || key === "ArrowUp") {
                  return ColorPickerMsg.ChannelChanged({
                    channel,
                    value: Math.min(max, value + step)
                  })
                }
                if (key === decKey || key === "ArrowDown") {
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
        )
    }

    return h.div
      .attrs({
        role: "group",
        "aria-label": p.label,
        ...(p.dir !== undefined ? { dir: p.dir } : {}),
        "data-color-picker": ""
      })
      .children(
        h.span.attrs({
          "data-color-swatch": "",
          "aria-hidden": "true",
          style: `background-color:${hex}`
        }),
        slider("l", "L", "Lightness", parsed.l, 0, 1, 0.05),
        slider("c", "C", "Chroma", parsed.c, 0, 0.37, 0.01),
        slider("h", "H", "Hue", parsed.h, 0, 359, 5),
        h.input
          .attrs({
            id: `${prefix}-hex`,
            type: "text",
            "aria-label": `${p.label} hex value`,
            autocomplete: "off",
            autocapitalize: "none",
            autocorrect: "off",
            spellcheck: "false",
            ...(isInvalid ? { "aria-invalid": "true" } : {})
          })
          .value(displayText)
          .on("input", ({ value }) => ColorPickerMsg.DraftEdited({ raw: value }))
          .on("blur", () => ColorPickerMsg.DraftCommitted())
          .on(
            "keydown",
            ({ key, composing }) => {
              if (composing) return undefined
              if (key === "Enter") return ColorPickerMsg.DraftCommitted()
              if (key === "Escape") return ColorPickerMsg.DraftReverted()
              return undefined
            },
            { preventDefault: true }
          ),
        contrast !== undefined
          ? h.output
              .attrs({
                "aria-label": "Contrast ratio",
                "data-contrast-ratio": String(contrast)
              })
              .children(`${contrast}:1`)
          : undefined
      )
  }
})
