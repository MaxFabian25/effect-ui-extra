import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import { HtmlLocator, HtmlPlay } from "@effect/ui/html/testing"
import { TestHost } from "@effect/ui/testing"
import { describe, expect, it } from "bun:test"
import { Duration, Effect, Layer, Schema } from "effect"
import { TestClock } from "effect/testing"
import { A11yFocus, checkAccessibleNames } from "../../src/a11y/index.js"
import { checkServer } from "../../src/page/index.js"
import {
  Carousel,
  clampCropRect,
  computeWaterfallLayout,
  cropToPixels,
  formatDurationMs,
  ImageCropper,
  moveCropRect,
  resizeCropRect,
  Timeline,
  Waterfall,
  zoomCropRect
} from "../../src/widgets/index.js"

const playLayer = Layer.mergeAll(
  TestHost.layer(),
  A11yFocus.layer,
  TestClock.layer()
)

const runPlay = <A, E>(
  eff: Effect.Effect<
    A,
    E,
    TestHost.TestHost | A11yFocus.FocusTracker | Html.Host | TestClock.TestClock
  >
) => Effect.runPromise(eff.pipe(Effect.provide(playLayer)))

const CarouselHost = Html.component({
  name: "CarouselHost",
  props: Schema.Struct({
    autoplay: Schema.optional(Schema.Boolean),
    dir: Schema.optional(Schema.Literals(["ltr", "rtl"]))
  }),
  model: Schema.Struct({}),
  message: UiSchema.TaggedEnum({ Noop: {} })
}).make({
  init: () => ({}),
  update: { Noop: ($) => $.model },
  view: (h) =>
    Carousel(h, {
      props: {
        label: "Featured releases",
        autoplay: h.props.autoplay,
        autoplayIntervalMs: 1000,
        loop: true,
        dir: h.props.dir,
        slides: [
          { id: "s1", label: "Release 1", content: "First slide body" },
          { id: "s2", label: "Release 2", content: "Second slide body" },
          { id: "s3", label: "Release 3", content: "Third slide body" }
        ]
      }
    })
})

const CropperHost = Html.component({
  name: "CropperHost",
  model: Schema.Struct({}),
  message: UiSchema.TaggedEnum({ Noop: {} })
}).make({
  init: () => ({}),
  update: { Noop: ($) => $.model },
  view: (h) =>
    ImageCropper(h, {
      props: {
        label: "Avatar",
        src: "/avatar.png",
        alt: "User profile photo",
        imageWidth: 1000,
        imageHeight: 500,
        aspectRatio: 1
      }
    })
})

const TimelineHostMsg = UiSchema.TaggedEnum({ Select: { id: Schema.String } })
const TimelineHost = Html.component({
  name: "TimelineHost",
  model: Schema.Struct({ activeId: Schema.String }),
  message: TimelineHostMsg
}).make({
  init: () => ({ activeId: "build" }),
  update: { Select: ($, { id }) => $.evolve({ activeId: id }) },
  view: (h, model) =>
    Timeline(h, {
      props: {
        label: "Deploy stages",
        selectable: true,
        activeId: model.activeId,
        items: [
          { id: "plan", title: "Plan", timestamp: "09:00", status: "completed" },
          { id: "build", title: "Build", timestamp: "09:02", status: "current" },
          { id: "ship", title: "Ship", timestamp: "09:05", status: "upcoming" }
        ]
      },
      onEmit: { ItemSelected: ({ id }) => TimelineHostMsg.Select({ id }) }
    })
})

const WaterfallHost = Html.component({
  name: "WaterfallHost",
  model: Schema.Struct({}),
  message: UiSchema.TaggedEnum({ Noop: {} })
}).make({
  init: () => ({}),
  update: { Noop: ($) => $.model },
  view: (h) =>
    Waterfall(h, {
      props: {
        label: "Agent trace",
        spans: [
          { id: "root", label: "request", startMs: 0, durationMs: 200, depth: 0, status: "ok" },
          { id: "db", label: "postgres.query", startMs: 20, durationMs: 80, depth: 1, status: "ok" },
          { id: "llm", label: "model.call", startMs: 100, durationMs: 100, depth: 1, status: "error" }
        ]
      }
    })
})

describe("Carousel widget", () => {
  it("navigates via buttons, keyboard, RTL, TestClock autoplay, and passes a11y + SSR", () =>
    runPlay(
      Effect.gen(function*() {
        yield* checkServer(CarouselHost, {})

        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(CarouselHost, { autoplay: true })
            yield* checkAccessibleNames(play)

            const region = HtmlLocator.role("region", { name: "Featured releases" })
            yield* play.expect(region).toHaveAttribute("data-index", "0")

            const nextBtn = HtmlLocator.role("button", { name: "Next slide" })
            yield* play.click(nextBtn)
            yield* play.expect(region).toHaveAttribute("data-index", "1")

            // Pause autoplay, advance clock, confirm index does not move
            const pauseBtn = HtmlLocator.role("button", { name: "Pause slide show" })
            yield* play.click(pauseBtn)
            yield* TestClock.adjust(Duration.millis(2500))
            yield* TestHost.settle
            yield* play.expect(region).toHaveAttribute("data-index", "1")

            // Resume autoplay and verify TestClock advances the slide
            const playBtn = HtmlLocator.role("button", { name: "Play slide show" })
            yield* play.click(playBtn)
            yield* TestClock.adjust(Duration.millis(1100))
            yield* TestHost.settle
            yield* play.expect(region).toHaveAttribute("data-index", "2")
          })
        )

        // RTL ArrowLeft advances to next slide
        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(CarouselHost, { dir: "rtl" })
            const region = HtmlLocator.role("region", { name: "Featured releases" })
            yield* play.keydown(region, "ArrowLeft")
            yield* play.expect(region).toHaveAttribute("data-index", "1")
          })
        )
      })
    ))
})

describe("ImageCropper widget and pure crop math", () => {
  it("enforces aspect ratio, bounds, zoom, pixel conversion, keyboard controls, and SSR purity", () =>
    runPlay(
      Effect.gen(function*() {
        // 1:1 square crop on a 1000x500 image: normalized width 0.4 => 400px, height 0.8 => 400px
        const clamped = clampCropRect(
          { x: 0.9, y: 0.9, width: 0.4, height: 0.4 },
          { aspectRatio: 1, imageWidth: 1000, imageHeight: 500 }
        )
        const px = cropToPixels(clamped, 1000, 500)
        expect(px.width).toBe(px.height)
        expect(px.x + px.width).toBeLessThanOrEqual(1000)
        expect(px.y + px.height).toBeLessThanOrEqual(500)

        const moved = moveCropRect({ x: 0.1, y: 0.1, width: 0.4, height: 0.4 }, 0.2, 0.1)
        expect(moved.x).toBe(0.3)
        expect(moved.y).toBe(0.2)

        const resized = resizeCropRect({ x: 0.1, y: 0.1, width: 0.4, height: 0.4 }, 0.1, 0.1)
        expect(resized.width).toBe(0.5)

        const zoomed = zoomCropRect({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }, 2)
        expect(zoomed.width).toBe(0.4)
        expect(zoomed.x).toBe(0.3)

        yield* checkServer(CropperHost, {})

        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(CropperHost, {})
            yield* checkAccessibleNames(play)

            const app = HtmlLocator.role("application")
            yield* play.expect(app).toHaveAttribute("data-crop-x", "0.1")
            yield* play.expect(app).toHaveAttribute("aria-describedby", "cropper-instructions")
            yield* play.expect(app).toHaveText("500\u00d7500")
            yield* play.keydown(app, "ArrowRight")
            yield* play.expect(app).toHaveAttribute("data-crop-x", "0.15")

            yield* play.expect(app).toHaveAttribute("data-crop-width", "0.5")
            yield* play.keydown(app, "+")
            yield* play.expect(app).toHaveAttribute("data-crop-width", "0.4545")
          })
        )
      })
    ))
})

describe("Timeline widget", () => {
  it("renders ordered steps, moves selection with keyboard, and passes a11y + SSR", () =>
    runPlay(
      Effect.gen(function*() {
        yield* checkServer(TimelineHost, {})

        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(TimelineHost, {})
            yield* checkAccessibleNames(play)

            const buildBtn = HtmlLocator.role("button", { name: "Build (09:02)" })
            yield* play.expect(buildBtn).toHaveAttribute("aria-current", "step")
            yield* play.keydown(buildBtn, "ArrowDown")
            const shipBtn = HtmlLocator.role("button", { name: "Ship (09:05)" })
            yield* play.expect(shipBtn).toHaveAttribute("tabindex", "0")
            yield* play.expect(shipBtn).toHaveAttribute("aria-current", "step")
          })
        )
      })
    ))
})

describe("Waterfall widget and layout math", () => {
  it("computes bar offsets, ticks, duration strings, keyboard selection, and passes a11y + SSR", () =>
    runPlay(
      Effect.gen(function*() {
        const layout = computeWaterfallLayout([
          { id: "a", label: "a", startMs: 100, durationMs: 50 },
          { id: "b", label: "b", startMs: 150, durationMs: 150 }
        ])
        expect(layout.totalDurationMs).toBe(200)
        expect(layout.bars[0]?.leftPct).toBe(0)
        expect(layout.bars[0]?.widthPct).toBe(25)
        expect(layout.bars[1]?.leftPct).toBe(25)
        expect(layout.bars[1]?.widthPct).toBe(75)
        expect(layout.ticks.length).toBe(5)
        expect(formatDurationMs(1250)).toBe("1.25s")
        expect(formatDurationMs(42)).toBe("42ms")

        yield* checkServer(WaterfallHost, {})

        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(WaterfallHost, {})
            yield* checkAccessibleNames(play)

            const grid = HtmlLocator.role("grid", { name: "Agent trace" })
            yield* play.expect(grid).toHaveAttribute("aria-rowcount", "4")
            yield* play.expect(grid).toHaveAttribute("aria-colcount", "2")
            const firstBtn = HtmlLocator.role("button", { name: "request, 200ms" })
            yield* play.keydown(firstBtn, "ArrowDown")
            const secondBtn = HtmlLocator.role("button", { name: "postgres.query, 80ms" })
            yield* play.expect(secondBtn).toHaveAttribute("tabindex", "0")
          })
        )
      })
    ))
})
