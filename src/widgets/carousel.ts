import { Subscription, UiSchema } from "@effect/ui"
import { Html, HtmlCommand, HtmlSubscription } from "@effect/ui/html"
import * as Data from "effect/Data"
import * as Duration from "effect/Duration"
import * as Option from "effect/Option"
import * as Schedule from "effect/Schedule"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import {
  carouselPageCount,
  isCarouselAutoplayActive,
  reduceCarousel
} from "../motion/carousel.js"
import type { CarouselEvent } from "../motion/carousel.js"
import { resolveDir } from "./internal.js"

const MotionCarouselEvent = Data.taggedEnum<CarouselEvent>()

export const CarouselSlideSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  content: Schema.String
})
export type CarouselSlide = typeof CarouselSlideSchema.Type

export const CarouselProps = Schema.Struct({
  label: Schema.String,
  slides: Schema.Array(CarouselSlideSchema),
  index: Schema.optional(Schema.Finite),
  slidesPerPage: Schema.optional(Schema.Finite),
  loop: Schema.optional(Schema.Boolean),
  autoplay: Schema.optional(Schema.Boolean),
  autoplayIntervalMs: Schema.optional(Schema.Finite),
  reducedMotion: Schema.optional(Schema.Boolean),
  dir: Schema.optional(Schema.Literals(["ltr", "rtl"])),
  idPrefix: Schema.optional(Schema.String)
})
export type CarouselProps = typeof CarouselProps.Type

export const CarouselEvents = UiSchema.TaggedEnum({
  IndexChanged: { index: Schema.Finite },
  AutoplayToggled: { paused: Schema.Boolean }
})
export type CarouselEvents = typeof CarouselEvents.Type

const CarouselDragSchema = Schema.Struct({
  pointerId: Schema.Finite,
  startX: Schema.Finite,
  lastX: Schema.Finite,
  viewportPx: Schema.Finite
})

const CarouselModel = Schema.Struct({
  index: Schema.Finite,
  hovered: Schema.Boolean,
  focused: Schema.Boolean,
  pausedByUser: Schema.Boolean,
  pageHidden: Schema.Boolean,
  systemReducedMotion: Schema.Boolean,
  dragOffsetPx: Schema.Finite,
  drag: Schema.NullOr(CarouselDragSchema)
})

const CarouselMsg = UiSchema.TaggedEnum({
  Next: {},
  Previous: {},
  GoTo: { index: Schema.Finite },
  SetHovered: { hovered: Schema.Boolean },
  SetFocused: { focused: Schema.Boolean },
  SetPageHidden: { hidden: Schema.Boolean },
  SetSystemReducedMotion: { reducedMotion: Schema.Boolean },
  TogglePause: {},
  AutoplayTick: {},
  DragStart: { pointerId: Schema.Finite, x: Schema.Finite },
  TrackMeasured: { width: Schema.Finite },
  DragMove: { pointerId: Schema.Finite, x: Schema.Finite, isRtl: Schema.Boolean },
  DragEnd: { pointerId: Schema.Finite, x: Schema.Finite, isRtl: Schema.Boolean },
  DragCancel: { pointerId: Schema.optional(Schema.Finite) },
  FocusDone: {}
})

const dotRef = (idx: number) => Html.ref(`CarouselDot[${idx}]`, "button")
const trackRef = Html.ref("CarouselTrack", "div")

const toMotionState = (
  model: typeof CarouselModel.Type,
  props: CarouselProps
) => ({
  index: props.index ?? model.index,
  pageCount: carouselPageCount(props.slides.length, props.slidesPerPage),
  dragging: model.drag !== null,
  dragOffsetPx: model.dragOffsetPx,
  hovered: model.hovered,
  focused: model.focused,
  pausedByUser: model.pausedByUser || model.pageHidden
})

const toMotionConfig = (
  model: typeof CarouselModel.Type,
  props: CarouselProps
) => ({
  slideCount: props.slides.length,
  slidesPerPage: props.slidesPerPage,
  loop: props.loop,
  autoplay: props.autoplay,
  reducedMotion: props.reducedMotion ?? model.systemReducedMotion
})

/**
 * Accessible WAI-ARIA Carousel widget wired to `reduceCarousel` from
 * `effect-ui-extra/motion` with RTL-aware Arrow navigation, pointer swipe,
 * Home/End jumps, slide indicators, and `TestClock`-driven autoplay that pauses
 * on hover, focus, page visibility hide, explicit toggle, or
 * `prefers-reduced-motion`.
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
    pausedByUser: false,
    pageHidden: false,
    systemReducedMotion: false,
    dragOffsetPx: 0,
    drag: null
  }),
  subscriptions: ($) => {
    const subs: Array<Subscription.Subscription<typeof CarouselMsg.Type>> = []
    if ($.props.reducedMotion === undefined) {
      subs.push(
        HtmlSubscription.onMediaQuery(
          "(prefers-reduced-motion: reduce)",
          (reducedMotion) => CarouselMsg.SetSystemReducedMotion({ reducedMotion })
        )
      )
    }
    if ($.props.autoplay === true) {
      subs.push(
        HtmlSubscription.onVisibility((visible) =>
          CarouselMsg.SetPageHidden({ hidden: !visible })
        )
      )
    }
    const active = isCarouselAutoplayActive(
      toMotionState($.model, $.props),
      toMotionConfig($.model, $.props)
    )
    if (active) {
      const ms = Math.max(50, Math.floor($.props.autoplayIntervalMs ?? 5000))
      subs.push(
        Subscription.make(
          `effect-ui-widgets/carousel-autoplay/${$.props.idPrefix ?? "carousel"}/${ms}`,
          Stream.fromSchedule(Schedule.spaced(Duration.millis(ms))).pipe(
            Stream.map(() => CarouselMsg.AutoplayTick())
          )
        )
      )
    }
    if ($.model.drag !== null) {
      subs.push(
        HtmlSubscription.onDocument("pointercancel", ({ pointerId }) =>
          CarouselMsg.DragCancel({ pointerId })
        ),
        HtmlSubscription.onWindow("blur", () => CarouselMsg.DragCancel({}))
      )
    }
    return subs
  },
  update: {
    Next: ($) => {
      const next = reduceCarousel(
        toMotionState($.model, $.props),
        MotionCarouselEvent.Next(),
        toMotionConfig($.model, $.props)
      )
      if (next.index === ($.props.index ?? $.model.index)) return $.model
      return $.evolve({ index: next.index }).emit(
        CarouselEvents.IndexChanged({ index: next.index })
      )
    },
    Previous: ($) => {
      const next = reduceCarousel(
        toMotionState($.model, $.props),
        MotionCarouselEvent.Previous(),
        toMotionConfig($.model, $.props)
      )
      if (next.index === ($.props.index ?? $.model.index)) return $.model
      return $.evolve({ index: next.index }).emit(
        CarouselEvents.IndexChanged({ index: next.index })
      )
    },
    GoTo: ($, { index }) => {
      const next = reduceCarousel(
        toMotionState($.model, $.props),
        MotionCarouselEvent.GoTo({ index }),
        toMotionConfig($.model, $.props)
      )
      return $.evolve({ index: next.index })
        .emit(CarouselEvents.IndexChanged({ index: next.index }))
        .run(HtmlCommand.focus(dotRef(next.index), () => CarouselMsg.FocusDone()))
    },
    SetHovered: ($, { hovered }) => $.evolve({ hovered }),
    SetFocused: ($, { focused }) => $.evolve({ focused }),
    SetPageHidden: ($, { hidden }) => $.evolve({ pageHidden: hidden }),
    SetSystemReducedMotion: ($, { reducedMotion }) =>
      $.evolve({ systemReducedMotion: reducedMotion }),
    TogglePause: ($) => {
      const pausedByUser = !$.model.pausedByUser
      return $.evolve({ pausedByUser }).emit(
        CarouselEvents.AutoplayToggled({ paused: pausedByUser })
      )
    },
    AutoplayTick: ($) => {
      const next = reduceCarousel(
        toMotionState($.model, $.props),
        MotionCarouselEvent.AutoplayTick(),
        toMotionConfig($.model, $.props)
      )
      if (next.index === ($.props.index ?? $.model.index)) return $.model
      return $.evolve({ index: next.index }).emit(
        CarouselEvents.IndexChanged({ index: next.index })
      )
    },
    DragStart: ($, { pointerId, x }) =>
      $.evolve({
        dragOffsetPx: 0,
        drag: { pointerId, startX: x, lastX: x, viewportPx: 320 }
      }).run(
        HtmlCommand.measure(trackRef, (rect) =>
          CarouselMsg.TrackMeasured({
            width: Option.isSome(rect) && rect.value.width > 0 ? rect.value.width : 320
          })
        )
      ),
    TrackMeasured: ($, { width }) =>
      $.model.drag === null
        ? $.model
        : $.evolve({ drag: { ...$.model.drag, viewportPx: width } }),
    DragMove: ($, { isRtl, pointerId, x }) => {
      const drag = $.model.drag
      if (drag === null || drag.pointerId !== pointerId) return $.model
      const rawDelta = x - drag.startX
      const deltaPx = isRtl ? -rawDelta : rawDelta
      const next = reduceCarousel(
        toMotionState($.model, $.props),
        MotionCarouselEvent.DragMove({ deltaPx, viewportPx: drag.viewportPx }),
        toMotionConfig($.model, $.props)
      )
      return $.evolve({
        dragOffsetPx: next.dragOffsetPx,
        drag: { ...drag, lastX: x }
      })
    },
    DragEnd: ($, { isRtl, pointerId, x }) => {
      const drag = $.model.drag
      if (drag === null || drag.pointerId !== pointerId) return $.model
      const rawDelta = x - drag.startX
      const deltaPx = isRtl ? -rawDelta : rawDelta
      const moved = reduceCarousel(
        toMotionState($.model, $.props),
        MotionCarouselEvent.DragMove({ deltaPx, viewportPx: drag.viewportPx }),
        toMotionConfig($.model, $.props)
      )
      // Approximate velocity from final drag displacement for flick responsiveness
      const velocityPxPerSec =
        Math.abs(deltaPx) >= Math.max(32, drag.viewportPx * 0.15)
          ? Math.sign(deltaPx) * 800
          : 0
      const settled = reduceCarousel(
        moved,
        MotionCarouselEvent.DragEnd({ velocityPxPerSec, viewportPx: drag.viewportPx }),
        toMotionConfig($.model, $.props)
      )
      const prevIdx = $.props.index ?? $.model.index
      if (settled.index === prevIdx) {
        return $.evolve({ drag: null, dragOffsetPx: 0 })
      }
      return $.evolve({ index: settled.index, drag: null, dragOffsetPx: 0 }).emit(
        CarouselEvents.IndexChanged({ index: settled.index })
      )
    },
    DragCancel: ($, { pointerId }) => {
      if (
        $.model.drag === null ||
        (pointerId !== undefined && $.model.drag.pointerId !== pointerId)
      ) {
        return $.model
      }
      const next = reduceCarousel(
        toMotionState($.model, $.props),
        MotionCarouselEvent.DragCancel(),
        toMotionConfig($.model, $.props)
      )
      return $.evolve({ drag: null, dragOffsetPx: next.dragOffsetPx })
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
    const prefix = p.idPrefix ?? "carousel"
    const canPrev = pageCount > 1 && (loop || activeIndex > 0)
    const canNext = pageCount > 1 && (loop || activeIndex < pageCount - 1)
    const startSlide = activeIndex * perPage
    const visibleSlides = p.slides.slice(startSlide, startSlide + perPage)
    const autoplayOn = isCarouselAutoplayActive(
      toMotionState(model, p),
      toMotionConfig(model, p)
    )

    return h.section
      .attrs({
        role: "region",
        "aria-roledescription": "carousel",
        "aria-label": p.label,
        ...(p.dir !== undefined ? { dir: p.dir } : {}),
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
          const isRtl = resolveDir(p.dir) === "rtl"
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
                        ? "Play slide show"
                        : "Pause slide show",
                      "aria-pressed": String(model.pausedByUser)
                    })
                    .on("click", () => CarouselMsg.TogglePause())
                    .children(model.pausedByUser ? "Play" : "Pause")
                ]
              : [])
          ),
        h.div
          .ref(trackRef)
          .attrs({
            id: `${prefix}-slides`,
            "aria-live": autoplayOn ? "off" : "polite",
            "data-carousel-track": "",
            ...(model.drag !== null ? { "data-dragging": "true" } : {})
          })
          .style(
            model.dragOffsetPx !== 0
              ? { transform: `translate3d(${model.dragOffsetPx}px, 0, 0)` }
              : {}
          )
          .on(
            "pointerdown",
            ({ button, pointerId, x }) =>
              button === 0 && pageCount > 1
                ? CarouselMsg.DragStart({ pointerId, x })
                : undefined,
            { capturePointer: true }
          )
          .on("pointermove", ({ pointerId, x }) =>
            model.drag !== null && model.drag.pointerId === pointerId
              ? CarouselMsg.DragMove({ pointerId, x, isRtl: resolveDir(p.dir) === "rtl" })
              : undefined
          )
          .on("pointerup", ({ pointerId, x }) =>
            model.drag !== null && model.drag.pointerId === pointerId
              ? CarouselMsg.DragEnd({ pointerId, x, isRtl: resolveDir(p.dir) === "rtl" })
              : undefined
          )
          .on("pointercancel", ({ pointerId }) =>
            model.drag !== null && model.drag.pointerId === pointerId
              ? CarouselMsg.DragCancel({ pointerId })
              : undefined
          )
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
