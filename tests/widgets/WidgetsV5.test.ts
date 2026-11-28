import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import { HtmlLocator, HtmlPlay } from "@effect/ui/html/testing"
import { TestHost } from "@effect/ui/testing"
import { describe, expect, it } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { TestClock } from "effect/testing"
import { A11yFocus, checkAccessibleNames } from "../../src/a11y/index.js"
import { checkServer } from "../../src/page/index.js"
import {
  AreaPicker,
  areStructuredTokensReady,
  DateTimePicker,
  parseDateTimeString,
  projectScrollPickerIndex,
  resolveStructuredToken,
  ScrollPicker,
  serializeStructuredPrompt,
  upsertStructuredToken
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

const AreaHost = Html.component({
  name: "AreaHost",
  props: Schema.Struct({ dir: Schema.optional(Schema.Literals(["ltr", "rtl"])) }),
  model: Schema.Struct({}),
  message: UiSchema.TaggedEnum({ Noop: {} })
}).make({
  init: () => ({}),
  update: { Noop: ($) => $.model },
  view: (h) =>
    AreaPicker(h, {
      props: {
        label: "Focal point",
        xLabel: "Horizontal",
        yLabel: "Vertical",
        dir: h.props.dir
      }
    })
})

const DateTimeHostMsg = UiSchema.TaggedEnum({ Set: { value: Schema.String } })
const DateTimeHost = Html.component({
  name: "DateTimeHost",
  model: Schema.Struct({ value: Schema.String }),
  message: DateTimeHostMsg
}).make({
  init: () => ({ value: "2026-11-28T09:30" }),
  update: { Set: (_, { value }) => ({ value }) },
  view: (h, model) =>
    DateTimePicker(h, {
      props: { label: "Appointment", value: model.value, locale: "da-DK", hourCycle: 24 },
      onEmit: { ValueChanged: ({ value }) => DateTimeHostMsg.Set({ value }) }
    })
})

const ScrollHost = Html.component({
  name: "ScrollHost",
  model: Schema.Struct({}),
  message: UiSchema.TaggedEnum({ Noop: {} })
}).make({
  init: () => ({}),
  update: { Noop: ($) => $.model },
  view: (h) =>
    ScrollPicker(h, {
      props: {
        label: "Hour wheel",
        options: [
          { value: "08", label: "08:00" },
          { value: "09", label: "09:00", disabled: true },
          { value: "10", label: "10:00" },
          { value: "11", label: "11:00" }
        ]
      }
    })
})

describe("AreaPicker 2D XY widget", () => {
  it("steps both axes with Arrow and Shift+Arrow, reverses horizontal in RTL, and passes a11y + SSR", () =>
    runPlay(
      Effect.gen(function*() {
        yield* checkServer(AreaHost, {})

        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(AreaHost, {})
            yield* checkAccessibleNames(play)
            const slider = HtmlLocator.role("slider", { name: "Focal point" })
            yield* play.keydown(slider, "ArrowRight")
            yield* play.keydown(slider, "ArrowUp", { shift: true })
            yield* play.expect(slider).toHaveAttribute("data-x", "1")
            yield* play.expect(slider).toHaveAttribute("data-y", "10")
            yield* play.expect(slider).toHaveAttribute("aria-valuetext", "Horizontal 1, Vertical 10")
          })
        )

        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(AreaHost, { dir: "rtl" })
            const slider = HtmlLocator.role("slider", { name: "Focal point" })
            yield* play.keydown(slider, "ArrowLeft")
            yield* play.expect(slider).toHaveAttribute("data-x", "1")
          })
        )
      })
    ))
})

describe("ScrollPicker momentum wheel widget", () => {
  it("projects flicks onto nearest enabled option, skips disabled options via keyboard, and passes SSR", () =>
    runPlay(
      Effect.gen(function*() {
        const projected = projectScrollPickerIndex({
          currentIndex: 0,
          velocityItemsPerMs: 0.004,
          options: [
            { value: "08", label: "08:00" },
            { value: "09", label: "09:00", disabled: true },
            { value: "10", label: "10:00" },
            { value: "11", label: "11:00" }
          ]
        })
        expect(projected).toBeGreaterThanOrEqual(2)

        yield* checkServer(ScrollHost, {})
        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(ScrollHost, {})
            yield* checkAccessibleNames(play)
            const lb = HtmlLocator.role("listbox", { name: "Hour wheel" })
            yield* play.keydown(lb, "ArrowDown")
            // Skips disabled 09:00 and lands on index 2 (10:00)
            yield* play.expect(lb).toHaveAttribute("data-active-index", "2")
          })
        )
      })
    ))
})

describe("DateTimePicker and StructuredTokens", () => {
  it("combines CLDR PlainDate stepping with TimeInput spinbuttons and passes a11y + SSR", () =>
    runPlay(
      Effect.gen(function*() {
        expect(parseDateTimeString("2026-11-28T09:30")).toEqual({ date: "2026-11-28", time: "09:30" })
        yield* checkServer(DateTimeHost, {})

        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(DateTimeHost, {})
            yield* checkAccessibleNames(play)
            const group = HtmlLocator.role("group", { name: "Appointment" })
            yield* play.expect(group).toHaveAttribute("data-first-day-of-week", "1")
            const hour = HtmlLocator.role("spinbutton", { name: "Hour" })
            yield* play.keydown(hour, "ArrowUp")
            yield* play.expect(hour).toHaveAttribute("aria-valuetext", "10")
          })
        )
      })
    ))

  it("tracks pending/unresolved structured tokens and serializes prompt prefixes", () => {
    let tokens = upsertStructuredToken([], {
      id: "t1",
      type: "file",
      value: "src/app.ts",
      label: "app.ts",
      status: "pending"
    })
    expect(areStructuredTokensReady(tokens)).toBe(false)
    tokens = resolveStructuredToken(tokens, "t1", { status: "ready" })
    expect(areStructuredTokensReady(tokens)).toBe(true)
    expect(serializeStructuredPrompt(tokens, "Review this")).toBe("[file:src/app.ts] Review this")
  })
})
