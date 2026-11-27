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
  Command,
  InlineEdit,
  TokenInput,
  TriggerMenu,
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

            const minute = HtmlLocator.role("spinbutton", { name: "Minute" })
            yield* play.keydown(minute, "Home")
            yield* play.expect(minute).toHaveAttribute("aria-valuetext", "00")
            yield* play.keydown(minute, "End")
            yield* play.expect(minute).toHaveAttribute("aria-valuetext", "59")
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

            yield* play.type(lightness, "0.65")
            yield* play.expect(lightness).toHaveAttribute("aria-valuenow", "0.65")

            yield* play.type(hexInput, "#000000")
            yield* play.expect(hexInput).toHaveValue("#000000")
          })
        )
      })
    ))
})

describe("IME-safe Enter handling across text-input widgets", () => {
  it("ignores Enter while composing in InlineEdit, TokenInput, Command, and TriggerMenu", () =>
    runPlay(
      Effect.gen(function*() {
        // 1. InlineEdit
        let inlineCommitted: string | undefined
        const InlineHost = Html.component({
          name: "InlineImeHost",
          model: Schema.Struct({ value: Schema.String }),
          message: UiSchema.TaggedEnum({ Set: { value: Schema.String } })
        }).make({
          init: () => ({ value: "Initial" }),
          update: {
            Set: (_, { value }) => {
              inlineCommitted = value
              return { value }
            }
          },
          view: (h, model) =>
            InlineEdit(h, {
              props: { label: "Title", value: model.value },
              onEmit: {
                Committed: ({ value }) => ({ _tag: "Set" as const, value }),
                Cancelled: () => undefined
              }
            })
        })
        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(InlineHost, {})
            yield* play.click(HtmlLocator.role("button", { name: "Title: Initial" }))
            const input = HtmlLocator.role("textbox", { name: "Title" })
            yield* play.type(input, "東京")
            yield* play.keydown(input, "Enter", { composing: true })
            yield* play.expectIgnored()
            expect(inlineCommitted).toBeUndefined()
            yield* play.keydown(input, "Enter", { composing: false })
            expect(inlineCommitted).toBe("東京")
          })
        )

        // 2. TokenInput
        let tokens: ReadonlyArray<string> = []
        const TokenHost = Html.component({
          name: "TokenImeHost",
          model: Schema.Struct({ tokens: Schema.Array(Schema.String) }),
          message: UiSchema.TaggedEnum({ Set: { tokens: Schema.Array(Schema.String) } })
        }).make({
          init: () => ({ tokens: [] }),
          update: {
            Set: (_, { tokens: next }) => {
              tokens = next
              return { tokens: next }
            }
          },
          view: (h, model) =>
            TokenInput(h, {
              props: { label: "Tags", tokens: [...model.tokens] },
              onEmit: {
                TokensChanged: ({ tokens: next }) => ({ _tag: "Set" as const, tokens: [...next] })
              }
            })
        })
        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(TokenHost, {})
            const input = HtmlLocator.role("textbox", { name: "Tags" })
            yield* play.type(input, "設計")
            yield* play.keydown(input, "Enter", { composing: true })
            yield* play.expectIgnored()
            expect(tokens).toEqual([])
            yield* play.keydown(input, "Enter", { composing: false })
            expect(tokens).toEqual(["設計"])
          })
        )

        // 3. Command
        let commandPicked: string | undefined
        const CommandHost = Html.component({
          name: "CommandImeHost",
          model: Schema.Struct({ open: Schema.Boolean }),
          message: UiSchema.TaggedEnum({ Picked: { value: Schema.String } })
        }).make({
          init: () => ({ open: true }),
          update: {
            Picked: ($, { value }) => {
              commandPicked = value
              return $.evolve({ open: false })
            }
          },
          view: (h, model) =>
            Command(h, {
              props: {
                open: model.open,
                label: "Commands",
                items: [{ value: "deploy", label: "Deploy" }]
              },
              onEmit: {
                Selected: ({ value }) => ({ _tag: "Picked" as const, value }),
                RequestedOpen: () => undefined,
                RequestedClose: () => undefined
              }
            })
        })
        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(CommandHost, {})
            const combobox = HtmlLocator.role("combobox", { name: "Commands" })
            yield* play.keydown(combobox, "Enter", { composing: true })
            yield* play.expectIgnored()
            expect(commandPicked).toBeUndefined()
            yield* play.keydown(combobox, "Enter", { composing: false })
            expect(commandPicked).toBe("deploy")
          })
        )

        // 4. TriggerMenu
        let triggerPicked: string | undefined
        const TriggerHost = Html.component({
          name: "TriggerImeHost",
          model: Schema.Struct({ text: Schema.String, caret: Schema.Number }),
          message: UiSchema.TaggedEnum({
            Edited: { text: Schema.String, caret: Schema.Number },
            Applied: { value: Schema.String, text: Schema.String, caret: Schema.Number }
          })
        }).make({
          init: () => ({ text: "@al", caret: 3 }),
          update: {
            Edited: (_, { text, caret }) => ({ text, caret }),
            Applied: (_, { value, text, caret }) => {
              triggerPicked = value
              return { text, caret }
            }
          },
          view: (h, model) =>
            TriggerMenu(h, {
              props: {
                label: "Message",
                text: model.text,
                caret: model.caret,
                suggestions: [{ value: "alice", label: "Alice" }]
              },
              onEmit: {
                TextChanged: ({ text, caret }) => ({ _tag: "Edited" as const, text, caret }),
                SuggestionApplied: ({ value, text, caret }) => ({
                  _tag: "Applied" as const,
                  value,
                  text,
                  caret
                })
              }
            })
        })
        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(TriggerHost, {})
            const combobox = HtmlLocator.role("combobox", { name: "Message" })
            yield* play.keydown(combobox, "Enter", { composing: true })
            yield* play.expectIgnored()
            expect(triggerPicked).toBeUndefined()
            yield* play.keydown(combobox, "Enter", { composing: false })
            expect(triggerPicked).toBe("alice")
          })
        )
      })
    ))
})
