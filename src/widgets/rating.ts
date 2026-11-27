import { UiSchema } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import * as Schema from "effect/Schema"

export const RatingProps = Schema.Struct({
  label: Schema.String,
  value: Schema.Number,
  max: Schema.optional(Schema.Number),
  step: Schema.optional(Schema.Literals([0.5, 1])),
  dir: Schema.optional(Schema.Literals(["ltr", "rtl"])),
  disabled: Schema.optional(Schema.Boolean),
  idPrefix: Schema.optional(Schema.String)
})
export type RatingProps = typeof RatingProps.Type

export const RatingEvents = UiSchema.TaggedEnum({
  ValueChanged: { value: Schema.Number }
})
export type RatingEvents = typeof RatingEvents.Type

const RatingMsg = UiSchema.TaggedEnum({
  Selected: { value: Schema.Number },
  FocusDone: {}
})

const ratingRef = (score: number) => Html.ref(`Rating[${score}]`, "button")

/**
 * Accessible WAI-ARIA `radiogroup` star/score rating supporting integer or
 * half-star steps, RTL-aware Arrow navigation, and `HtmlCommand.focus`.
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
    const isRtl = (p.dir ?? "ltr") === "rtl"
    const prefix = p.idPrefix ?? "rating"

    const scores: Array<number> = []
    for (let s = step; s <= max + 1e-9; s += step) {
      scores.push(Math.round(s * 10) / 10)
    }

    const activeScore = scores.includes(p.value) ? p.value : scores[0]!

    return h.div
      .attrs({
        role: "radiogroup",
        "aria-label": p.label,
        "aria-orientation": "horizontal",
        dir: p.dir,
        "data-rating": ""
      })
      .children(
        ...scores.map((score, idx) => {
          const checked = score === p.value
          const isStop = !p.disabled && score === activeScore
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
              "data-filled": score <= p.value ? "true" : "false",
              ...(p.disabled ? { "aria-disabled": "true", "data-disabled": "" } : {})
            })
            .on("click", () =>
              p.disabled ? undefined : RatingMsg.Selected({ value: score })
            )
            .on(
              "keydown",
              ({ key }) => {
                if (p.disabled) return undefined
                const nextKey = isRtl ? "ArrowLeft" : "ArrowRight"
                const prevKey = isRtl ? "ArrowRight" : "ArrowLeft"
                if (key === nextKey || key === "ArrowDown") {
                  const next = scores[(idx + 1) % scores.length]!
                  return RatingMsg.Selected({ value: next })
                }
                if (key === prevKey || key === "ArrowUp") {
                  const prev = scores[(idx - 1 + scores.length) % scores.length]!
                  return RatingMsg.Selected({ value: prev })
                }
                if (key === "Home") return RatingMsg.Selected({ value: scores[0]! })
                if (key === "End") return RatingMsg.Selected({ value: scores[scores.length - 1]! })
                if (key === " " || key === "Enter") return RatingMsg.Selected({ value: score })
                return undefined
              },
              { preventDefault: true }
            )
            .children(h.span.attrs({ "aria-hidden": "true" }).children(score <= p.value ? "★" : "☆"))
        })
      )
  }
})
