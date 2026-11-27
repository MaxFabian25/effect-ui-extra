import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import { HtmlLocator, HtmlPlay } from "@effect/ui/html/testing"
import { TestHost } from "@effect/ui/testing"
import { describe, expect, it } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { TestClock } from "effect/testing"
import {
  A11yFocus,
  checkAccessibleNames,
  checkDirection,
  checkPattern
} from "../../src/a11y/index.js"
import { checkServer } from "../../src/page/index.js"
import {
  ColorPicker,
  formatTimeString,
  initialInputHistoryState,
  inputHints,
  parseTimeString,
  Rating,
  recallHistoryNext,
  recallHistoryPrevious,
  stepTimeSegment,
  syncInputHistory,
  TimeInput
} from "../../src/widgets/index.js"

const playLayer = Layer.mergeAll(
  TestHost.layer(),
  A11yFocus.layer(),
  TestClock.layer()
)

const runPlay = <A, E>(
  eff: Effect.Effect<
    A,
    E,
    TestHost.TestHost | A11yFocus.FocusTracker | Html.Host | TestClock.TestClock
  >
) => Effect.runPromise(eff.pipe(Effect.provide(playLayer)))

const TimeHostMsg = UiSchema.TaggedEnum({ Set: { value: Schema.String } })
const TimeHost = Html.component({
  name: "TimeHost",
  model: Schema.Struct({ value: Schema.String }),
  message: TimeHostMsg
}).make({
  init: () => ({ value: "14:30" }),
  update: { Set: (_, { value }) => ({ value }) },
  view: (h, model) =>
    TimeInput(h, {
      props: { label: "Start time", value: model.value, hourCycle: 12 },
      onEmit: { ValueChanged: ({ value }) => TimeHostMsg.Set({ value }) }
    })
})

describe("TimeInput", () => {
  it("parses, formats, steps segments, handles 12h period flip, and passes a11y + SSR", () =>
    runPlay(
      Effect.gen(function*() {
        expect(parseTimeString("09:05:15")).toEqual({ hours: 9, minutes: 5, seconds: 15 })
        expect(parseTimeString("25:00")).toBeUndefined()
        expect(formatTimeString(stepTimeSegment({ hours: 23, minutes: 59, seconds: 0 }, "hour", 1))).toBe("00:59")

        yield* checkServer(TimeHost, {})

        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(TimeHost, {})
            yield* checkAccessibleNames(play)

            const hour = HtmlLocator.role("spinbutton", { name: "Hour" })
            const period = HtmlLocator.role("spinbutton", { name: "AM/PM" })
            yield* play.expect(hour).toHaveAttribute("aria-valuetext", "02")
            yield* play.expect(period).toHaveAttribute("aria-valuetext", "PM")

            yield* play.keydown(hour, "ArrowUp")
            yield* play.expect(hour).toHaveAttribute("aria-valuetext", "03")

            yield* play.keydown(period, "ArrowUp")
            yield* play.expect(period).toHaveAttribute("aria-valuetext", "AM")
          })
        )
      })
    ))
})

describe("InputHistory and inputHints", () => {
  it("recalls previous prompts, restores saved draft, and stays anchored across new entries", () => {
    const entries = ["first prompt", "second prompt"]
    let h = initialInputHistoryState<string>()

    const step1 = recallHistoryPrevious(h, entries, "unsent draft")
    expect(step1.handled).toBe(true)
    expect(step1.value).toBe("second prompt")
    h = step1.state

    const step2 = recallHistoryPrevious(h, entries, step1.value!)
    expect(step2.value).toBe("first prompt")
    h = step2.state

    // Live message appended while recalling keeps cursor anchored to "first prompt"
    const updated = [...entries, "third prompt"]
    h = syncInputHistory(h, entries, updated)
    expect(h.cursor).toBe(0)

    const fwd1 = recallHistoryNext(h, updated)
    expect(fwd1.value).toBe("second prompt")
    const fwd2 = recallHistoryNext(fwd1.state, updated)
    expect(fwd2.value).toBe("third prompt")
    const backToDraft = recallHistoryNext(fwd2.state, updated)
    expect(backToDraft.value).toBe("unsent draft")
    expect(backToDraft.state.cursor).toBeNull()
  })

  it("maps semantic field kinds to mobile keyboard and autofill attributes", () => {
    expect(inputHints("one-time-code")).toEqual({
      type: "text",
      inputmode: "numeric",
      autocomplete: "one-time-code",
      autocapitalize: "none",
      autocorrect: "off",
      spellcheck: "false"
    })
    expect(inputHints("message", { enterkeyhint: "enter" })).toMatchObject({
      enterkeyhint: "enter",
      spellcheck: "true"
    })
  })
})

const RatingHostMsg = UiSchema.TaggedEnum({ Set: { value: Schema.Number } })
const RatingHost = Html.component({
  name: "RatingHost",
  props: Schema.Struct({ dir: Schema.optional(Schema.Literals(["ltr", "rtl"])) }),
  model: Schema.Struct({ value: Schema.Number }),
  message: RatingHostMsg
}).make({
  init: () => ({ value: 3 }),
  update: { Set: (_, { value }) => ({ value }) },
  view: (h, model) =>
    Rating(h, {
      props: { label: "Satisfaction", value: model.value, max: 5, dir: h.props.dir },
      onEmit: { ValueChanged: ({ value }) => RatingHostMsg.Set({ value }) }
    })
})

describe("Rating", () => {
  it("passes effect-ui-a11y radio-group, checkDirection (LTR/RTL), and checkAccessibleNames", () =>
    runPlay(
      Effect.gen(function*() {
        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(RatingHost, {})
            yield* checkPattern(play, "radio-group")
            yield* checkAccessibleNames(play)
          })
        )
        yield* checkDirection((dir) => HtmlPlay.make(RatingHost, { dir }), "radio-group")
      })
    ))
})

const ColorHostMsg = UiSchema.TaggedEnum({ Set: { value: Schema.String } })
const ColorHost = Html.component({
  name: "ColorHost",
  model: Schema.Struct({ value: Schema.String }),
  message: ColorHostMsg
}).make({
  init: () => ({ value: "oklch(0.46 0.16 260)" }),
  update: { Set: (_, { value }) => ({ value }) },
  view: (h, model) =>
    ColorPicker(h, {
      props: {
        label: "Brand color",
        value: model.value,
        contrastAgainst: "#ffffff"
      },
      onEmit: {
        ValueChanged: ({ oklch }) => ColorHostMsg.Set({ value: oklch })
      }
    })
})

describe("ColorPicker (dogfooding effect-ui-theme)", () => {
  it("clamps OKLCH sliders to sRGB gamut, updates hex, computes WCAG contrast, and passes a11y + SSR", () =>
    runPlay(
      Effect.gen(function*() {
        yield* checkServer(ColorHost, {})

        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(ColorHost, {})
            yield* checkAccessibleNames(play)

            const lightness = HtmlLocator.role("slider", { name: "Brand color Lightness" })
            const hexInput = HtmlLocator.role("textbox", { name: "Brand color hex value" })

            yield* play.keydown(lightness, "ArrowRight")
            yield* play.expect(lightness).toHaveAttribute("aria-valuenow", "0.51")

            yield* play.type(hexInput, "#000000")
            yield* play.expect(hexInput).toHaveValue("#000000")
          })
        )
      })
    ))
})
