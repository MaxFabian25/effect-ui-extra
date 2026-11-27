import { Subscription, UiSchema } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import * as Duration from "effect/Duration"
import * as Schema from "effect/Schema"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"
import {
  carouselPageCount,
  isCarouselAutoplayActive,
  reduceCarousel
} from "../motion/carousel.js"

export const CarouselSlideSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  content: Schema.String
})
export type CarouselSlide = typeof CarouselSlideSchema.Type

export const CarouselProps = Schema.Struct({
  label: Schema.String,
  slides: Schema.Array(CarouselSlideSchema),
  index: Schema.optional(Schema.Number),
  slidesPerPage: Schema.optional(Schema.Number),
  loop: Schema.optional(Schema.Boolean),
  autoplay: Schema.optional(Schema.Boolean),
  autoplayIntervalMs: Schema.optional(Schema.Number),
  reducedMotion: Schema.optional(Schema.Boolean),
  dir: Schema.optional(Schema.Literals(["ltr", "rtl"])),
  idPrefix: Schema.optional(Schema.String)
})
export type CarouselProps = typeof CarouselProps.Type

export const CarouselEvents = UiSchema.TaggedEnum({
  IndexChanged: { index: Schema.Number },
  AutoplayToggled: { paused: Schema.Boolean }
})
export type CarouselEvents = typeof CarouselEvents.Type

const CarouselModel = Schema.Struct({
  index: Schema.Number,
  hovered: Schema.Boolean,
  focused: Schema.Boolean,
  pausedByUser: Schema.Boolean
})

const CarouselMsg = UiSchema.TaggedEnum({
  Next: {},
  Previous: {},
  GoTo: { index: Schema.Number },
  SetHovered: { hovered: Schema.Boolean },
  SetFocused: { focused: Schema.Boolean },
  TogglePause: {},
  AutoplayTick: {},
  FocusDone: {}
})

const dotRef = (idx: number) => Html.ref(`CarouselDot[${idx}]`, "button")

const toMotionState = (
  model: typeof CarouselModel.Type,
  props: CarouselProps
) => ({
  index: props.index ?? model.index,
  pageCount: carouselPageCount(props.slides.length, props.slidesPerPage),
  dragging: false,
  dragOffsetPx: 0,
  hovered: model.hovered,
  focused: model.focused,
  pausedByUser: model.pausedByUser
})

const toMotionConfig = (props: CarouselProps) => ({
  slideCount: props.slides.length,
  slidesPerPage: props.slidesPerPage,
  loop: props.loop,
  autoplay: props.autoplay,
  reducedMotion: props.reducedMotion
})

/**
 * Accessible WAI-ARIA Carousel widget wired to `reduceCarousel` from
 * `effect-ui-extra/motion` with RTL-aware Arrow navigation, Home/End jumps,
 * slide indicators, and `TestClock`-driven autoplay that pauses on hover,
 * focus, explicit toggle, or `prefers-reduced-motion`.
 */
export const Carousel = Html.component({
  name: "Carousel",
  props: CarouselProps,
  model: CarouselModel,
  message: CarouselMsg,
  events: CarouselEvents
}).make({
  init: ($) => ({
    index: Math.max(
      0,
      Math.min(
        Math.max(0, carouselPageCount($.props.slides.length, $.props.slidesPerPage) - 1),
        Math.floor($.props.index ?? 0)
      )
    ),
    hovered: false,
    focused: false,
    pausedByUser: false
  }),
  subscriptions: ($) => {
    const active = isCarouselAutoplayActive(toMotionState($.model, $.props), toMotionConfig($.props))
    if (!active) return []
    const ms = Math.max(50, Math.floor($.props.autoplayIntervalMs ?? 5000))
    return [
      Subscription.make(
        `effect-ui-widgets/carousel-autoplay/${$.props.idPrefix ?? "carousel"}/${ms}`,
        Stream.fromSchedule(Schedule.spaced(Duration.millis(ms))).pipe(
          Stream.map(() => CarouselMsg.AutoplayTick())
        )
      )
    ]
  },
  update: {
    Next: ($) => {
      const next = reduceCarousel(toMotionState($.model, $.props), { _tag: "Next" }, toMotionConfig($.props))
      if (next.index === ($.props.index ?? $.model.index)) return $.model
      return $.evolve({ index: next.index }).emit(CarouselEvents.IndexChanged({ index: next.index }))
    },
    Previous: ($) => {
      const next = reduceCarousel(toMotionState($.model, $.props), { _tag: "Previous" }, toMotionConfig($.props))
      if (next.index === ($.props.index ?? $.model.index)) return $.model
      return $.evolve({ index: next.index }).emit(CarouselEvents.IndexChanged({ index: next.index }))
    },
    GoTo: ($, { index }) => {
      const next = reduceCarousel(
        toMotionState($.model, $.props),
        { _tag: "GoTo", index },
        toMotionConfig($.props)
      )
      return $.evolve({ index: next.index })
        .emit(CarouselEvents.IndexChanged({ index: next.index }))
        .run(HtmlCommand.focus(dotRef(next.index), () => CarouselMsg.FocusDone()))
    },
    SetHovered: ($, { hovered }) => $.evolve({ hovered }),
    SetFocused: ($, { focused }) => $.evolve({ focused }),
    TogglePause: ($) => {
      const pausedByUser = !$.model.pausedByUser
      return $.evolve({ pausedByUser }).emit(CarouselEvents.AutoplayToggled({ paused: pausedByUser }))
    },
    AutoplayTick: ($) => {
      const next = reduceCarousel(
        toMotionState($.model, $.props),
        { _tag: "AutoplayTick" },
        toMotionConfig($.props)
      )
      if (next.index === ($.props.index ?? $.model.index)) return $.model
      return $.evolve({ index: next.index }).emit(CarouselEvents.IndexChanged({ index: next.index }))
    },
    FocusDone: ($) => $.model
  },
  view: (h, model) => {
    const p = h.props
    const perPage = Math.max(1, Math.floor(p.slidesPerPage ?? 1))
    const pageCount = carouselPageCount(p.slides.length, perPage)
    const activeIndex = Math.max(
      0,
      Math.min(Math.max(0, pageCount - 1), Math.floor(p.index ?? model.index))
    )
    const loop = p.loop ?? false
    const isRtl = (p.dir ?? "ltr") === "rtl"
    const prefix = p.idPrefix ?? "carousel"
    const canPrev = pageCount > 1 && (loop || activeIndex > 0)
    const canNext = pageCount > 1 && (loop || activeIndex < pageCount - 1)
    const startSlide = activeIndex * perPage
    const visibleSlides = p.slides.slice(startSlide, startSlide + perPage)
    const autoplayOn = isCarouselAutoplayActive(toMotionState(model, p), toMotionConfig(p))

    return h.section
      .attrs({
        role: "region",
        "aria-roledescription": "carousel",
        "aria-label": p.label,
        dir: p.dir,
        "data-carousel": "",
        "data-index": String(activeIndex)
      })
      .on("mouseenter", () => CarouselMsg.SetHovered({ hovered: true }))
      .on("mouseleave", () => CarouselMsg.SetHovered({ hovered: false }))
      .on("focusin", () => CarouselMsg.SetFocused({ focused: true }))
      .on("focusout", () => CarouselMsg.SetFocused({ focused: false }))
      .on(
        "keydown",
        ({ key }) => {
          const nextKey = isRtl ? "ArrowLeft" : "ArrowRight"
          const prevKey = isRtl ? "ArrowRight" : "ArrowLeft"
          if (key === nextKey) return CarouselMsg.Next()
          if (key === prevKey) return CarouselMsg.Previous()
          if (key === "Home") return CarouselMsg.GoTo({ index: 0 })
          if (key === "End" && pageCount > 0) return CarouselMsg.GoTo({ index: pageCount - 1 })
          return undefined
        },
        { preventDefault: true }
      )
      .children(
        h.div
          .attrs({ "data-carousel-controls": "" })
          .children(
            h.button
              .attrs({
                type: "button",
                "aria-label": "Previous slide",
                "aria-controls": `${prefix}-slides`,
                ...(canPrev ? {} : { disabled: "" })
              })
              .on("click", () => (canPrev ? CarouselMsg.Previous() : undefined))
              .children("Previous"),
            h.button
              .attrs({
                type: "button",
                "aria-label": "Next slide",
                "aria-controls": `${prefix}-slides`,
                ...(canNext ? {} : { disabled: "" })
              })
              .on("click", () => (canNext ? CarouselMsg.Next() : undefined))
              .children("Next"),
            ...(p.autoplay === true
              ? [
                  h.button
                    .attrs({
                      type: "button",
                      "aria-label": model.pausedByUser
                        ? "Start automatic slide show"
                        : "Stop automatic slide show",
                      "aria-pressed": String(model.pausedByUser)
                    })
                    .on("click", () => CarouselMsg.TogglePause())
                    .children(model.pausedByUser ? "Play" : "Pause")
                ]
              : [])
          ),
        h.div
          .attrs({
            id: `${prefix}-slides`,
            "aria-live": autoplayOn ? "off" : "polite",
            "data-carousel-track": ""
          })
          .children(
            ...visibleSlides.map((slide, offset) => {
              const absoluteIdx = startSlide + offset + 1
              return h.div
                .key(slide.id)
                .attrs({
                  role: "group",
                  "aria-roledescription": "slide",
                  "aria-label": `${absoluteIdx} of ${p.slides.length}: ${slide.label}`,
                  "data-carousel-slide": ""
                })
                .children(slide.content)
            })
          ),
        h.div
          .attrs({
            role: "group",
            "aria-label": "Choose a slide to display",
            "data-carousel-indicators": ""
          })
          .children(
            ...Array.from({ length: pageCount }, (_, i) => {
              const isCurrent = i === activeIndex
              return h.button
                .key(String(i))
                .ref(dotRef(i))
                .attrs({
                  type: "button",
                  "aria-label": `Slide ${i + 1} of ${pageCount}`,
                  ...(isCurrent ? { "aria-current": "true", "data-active": "" } : {})
                })
                .on("click", () => CarouselMsg.GoTo({ index: i }))
                .children(String(i + 1))
            })
          )
      )
  }
})
