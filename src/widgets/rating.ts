import { UiSchema } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { resolveDir, starIcon } from "./internal.js"

export const RatingProps = Schema.Struct({
  label: Schema.String,
  value: Schema.Finite,
  max: Schema.optional(Schema.Finite),
  step: Schema.optional(Schema.Literals([0.5, 1])),
  dir: Schema.optional(Schema.Literals(["ltr", "rtl"])),
  disabled: Schema.optional(Schema.Boolean),
  idPrefix: Schema.optional(Schema.String)
})
export type RatingProps = typeof RatingProps.Type

export const RatingEvents = UiSchema.TaggedEnum({
  ValueChanged: { value: Schema.Finite }
})
export type RatingEvents = typeof RatingEvents.Type

const RatingMsg = UiSchema.TaggedEnum({
  Selected: { value: Schema.Finite },
  FocusDone: {}
})

const ratingRef = (score: number) => Html.ref(`Rating[${score}]`, "button")

/**
 * Accessible WAI-ARIA `radiogroup` star/score rating supporting integer or
 * half-star SVG steps, RTL-aware Arrow navigation, and `HtmlCommand.focus`.
 */
export const Rating = Html.component({
  name: "Rating",
  props: RatingProps,
  model: Schema.Struct({}),
  message: RatingMsg,
  events: RatingEvents
}).make({
  init: () => ({}),
  update: {
    Selected: ($, { value }) => {
      if ($.props.disabled) return $.model
      return $.emit(RatingEvents.ValueChanged({ value })).run(
        HtmlCommand.focus(ratingRef(value), () => RatingMsg.FocusDone())
      )
    },
    FocusDone: ($) => $.model
  },
  view: (h) => {
    const p = h.props
    const max = Math.max(1, Math.floor(p.max ?? 5))
    const step = p.step ?? 1
    const prefix = p.idPrefix ?? "rating"
    const isHalfStep = step === 0.5

    const scores: Array<number> = []
    for (let s = step; s <= max + 1e-9; s += step) {
      scores.push(Math.round(s * 10) / 10)
    }

    const firstScore = scores[0] ?? step
    const lastScore = scores[scores.length - 1] ?? max
    const activeScore = scores.includes(p.value) ? p.value : firstScore

    const renderOption = (score: number, idx: number) => {
      const checked = score === p.value
      const isStop = !p.disabled && score === activeScore
      const filled = score <= p.value
      const half: "start" | "end" | undefined = isHalfStep
        ? idx % 2 === 0
          ? "start"
          : "end"
        : undefined
      return h.button
        .key(String(score))
        .ref(ratingRef(score))
        .attrs({
          id: `${prefix}-${String(score).replace(".", "_")}`,
          type: "button",
          role: "radio",
          "aria-checked": String(checked),
          "aria-label": `${score} out of ${max}`,
          tabindex: p.disabled ? "-1" : isStop ? "0" : "-1",
          "data-filled": filled ? "true" : "false",
          ...(half !== undefined ? { "data-half": half } : {}),
          ...(p.disabled ? { "aria-disabled": "true", "data-disabled": "" } : {})
        })
        .on("click", () =>
          p.disabled ? undefined : RatingMsg.Selected({ value: score })
        )
        .on(
          "keydown",
          ({ key }) => {
            if (p.disabled) return undefined
            const isRtl = resolveDir(p.dir) === "rtl"
            const nextKey = isRtl ? "ArrowLeft" : "ArrowRight"
            const prevKey = isRtl ? "ArrowRight" : "ArrowLeft"
            if (key === nextKey || key === "ArrowDown") {
              const next = scores[(idx + 1) % scores.length] ?? firstScore
              return RatingMsg.Selected({ value: next })
            }
            if (key === prevKey || key === "ArrowUp") {
              const prev = scores[(idx - 1 + scores.length) % scores.length] ?? lastScore
              return RatingMsg.Selected({ value: prev })
            }
            if (key === "Home") return RatingMsg.Selected({ value: firstScore })
            if (key === "End") return RatingMsg.Selected({ value: lastScore })
            if (key === " " || key === "Enter") return RatingMsg.Selected({ value: score })
            return undefined
          },
          { preventDefault: true }
        )
        .children(starIcon(h, filled, half))
    }

    const items = isHalfStep
      ? Array.from({ length: Math.ceil(scores.length / 2) }, (_, starIdx) => {
          const i0 = starIdx * 2
          const s0 = scores[i0]
          const s1 = scores[i0 + 1]
          const pair = s0 !== undefined ? [renderOption(s0, i0)] : []
          if (s1 !== undefined) {
            pair.push(renderOption(s1, i0 + 1))
          }
          return h.span
            .key(`star-${starIdx}`)
            .attrs({ "data-rating-star": "" })
            .children(...pair)
        })
      : scores.map(renderOption)

    return h.div
      .attrs({
        role: "radiogroup",
        "aria-label": p.label,
        "aria-orientation": "horizontal",
        ...(p.dir !== undefined ? { dir: p.dir } : {}),
        "data-rating": "",
        ...(isHalfStep ? { "data-half-step": "true" } : {})
      })
      .children(...items)
  }
})
