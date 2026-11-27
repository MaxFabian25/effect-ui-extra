import { findSnapIndex, rubberBand } from "./kinematics.js"

export interface CarouselConfig {
  readonly slideCount: number
  readonly slidesPerPage?: number | undefined
  readonly loop?: boolean | undefined
  readonly autoplay?: boolean | undefined
  readonly reducedMotion?: boolean | undefined
}

export interface CarouselState {
  readonly index: number
  readonly pageCount: number
  readonly dragging: boolean
  readonly dragOffsetPx: number
  readonly hovered: boolean
  readonly focused: boolean
  readonly pausedByUser: boolean
}

export type CarouselEvent =
  | { readonly _tag: "Next" }
  | { readonly _tag: "Previous" }
  | { readonly _tag: "GoTo"; readonly index: number }
  | { readonly _tag: "DragStart" }
  | { readonly _tag: "DragMove"; readonly deltaPx: number; readonly viewportPx: number }
  | { readonly _tag: "DragEnd"; readonly velocityPxPerSec: number; readonly viewportPx: number }
  | { readonly _tag: "SetHovered"; readonly hovered: boolean }
  | { readonly _tag: "SetFocused"; readonly focused: boolean }
  | { readonly _tag: "TogglePause" }
  | { readonly _tag: "AutoplayTick" }

export const carouselPageCount = (
  slideCount: number,
  slidesPerPage = 1
): number => {
  const count = Math.max(0, Math.floor(slideCount))
  const perPage = Math.max(1, Math.floor(slidesPerPage))
  if (count === 0) return 0
  return Math.max(1, Math.ceil(count / perPage))
}

export const initialCarouselState = (
  config: CarouselConfig,
  initialIndex = 0
): CarouselState => {
  const pageCount = carouselPageCount(config.slideCount, config.slidesPerPage)
  const index =
    pageCount === 0
      ? 0
      : Math.max(0, Math.min(pageCount - 1, Math.floor(initialIndex)))
  return {
    index,
    pageCount,
    dragging: false,
    dragOffsetPx: 0,
    hovered: false,
    focused: false,
    pausedByUser: false
  }
}

/**
 * Returns `true` only when autoplay is enabled and nothing (hover, focus,
 * active drag, explicit pause, `prefers-reduced-motion`, or `< 2` pages) is
 * suspending it.
 */
export const isCarouselAutoplayActive = (
  state: CarouselState,
  config: CarouselConfig
): boolean =>
  config.autoplay === true &&
  config.reducedMotion !== true &&
  state.pageCount > 1 &&
  !state.dragging &&
  !state.hovered &&
  !state.focused &&
  !state.pausedByUser

const clampIndex = (
  target: number,
  pageCount: number,
  loop: boolean
): number => {
  if (pageCount <= 0) return 0
  if (loop) return ((target % pageCount) + pageCount) % pageCount
  return Math.max(0, Math.min(pageCount - 1, target))
}

/**
 * Pure Elm-friendly reducer for snap carousels combining looping/clamping,
 * rubber-band edge drag, momentum snap-point selection, and accessible
 * autoplay suspension on hover, focus, or `prefers-reduced-motion`.
 */
export const reduceCarousel = (
  state: CarouselState,
  event: CarouselEvent,
  config: CarouselConfig
): CarouselState => {
  const pageCount = carouselPageCount(config.slideCount, config.slidesPerPage)
  const loop = config.loop ?? false
  const base: CarouselState =
    state.pageCount === pageCount
      ? state
      : {
          ...state,
          pageCount,
          index: clampIndex(state.index, pageCount, false)
        }

  switch (event._tag) {
    case "Next":
      return {
        ...base,
        index: clampIndex(base.index + 1, pageCount, loop),
        dragOffsetPx: 0
      }
    case "Previous":
      return {
        ...base,
        index: clampIndex(base.index - 1, pageCount, loop),
        dragOffsetPx: 0
      }
    case "GoTo":
      return {
        ...base,
        index: clampIndex(event.index, pageCount, loop),
        dragOffsetPx: 0
      }
    case "DragStart":
      return { ...base, dragging: true, dragOffsetPx: 0 }
    case "DragMove": {
      if (!base.dragging || pageCount <= 1) return base
      const vp = Math.max(1, event.viewportPx)
      const currentPos = base.index * vp
      const rawPos = currentPos - event.deltaPx
      const maxPos = (pageCount - 1) * vp
      const damped = loop
        ? rawPos
        : rubberBand(rawPos, 0, maxPos, vp * 0.5)
      return {
        ...base,
        dragOffsetPx: currentPos - damped
      }
    }
    case "DragEnd": {
      if (!base.dragging) return base
      if (pageCount <= 1) {
        return { ...base, dragging: false, dragOffsetPx: 0 }
      }
      const vp = Math.max(1, event.viewportPx)
      const currentPos = base.index * vp - base.dragOffsetPx
      const snaps = Array.from({ length: pageCount }, (_, i) => i * vp)
      // Negating drag velocity maps leftward flick (< 0) to positive forward scroll
      const nextIdx = findSnapIndex(currentPos, -event.velocityPxPerSec, snaps)
      return {
        ...base,
        dragging: false,
        dragOffsetPx: 0,
        index: clampIndex(nextIdx, pageCount, loop)
      }
    }
    case "SetHovered":
      return { ...base, hovered: event.hovered }
    case "SetFocused":
      return { ...base, focused: event.focused }
    case "TogglePause":
      return { ...base, pausedByUser: !base.pausedByUser }
    case "AutoplayTick":
      if (!isCarouselAutoplayActive(base, config)) return base
      return {
        ...base,
        index: clampIndex(base.index + 1, pageCount, true)
      }
  }
}
