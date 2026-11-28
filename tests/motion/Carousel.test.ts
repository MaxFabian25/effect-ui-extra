import { describe, expect, test } from "bun:test"
import * as Data from "effect/Data"
import {
  carouselPageCount,
  initialCarouselState,
  isCarouselAutoplayActive,
  reduceCarousel
} from "../../src/motion/index.js"
import type { CarouselEvent } from "../../src/motion/index.js"

const Ev = Data.taggedEnum<CarouselEvent>()

describe("Carousel reducer", () => {
  test("clamps non-looping navigation and wraps looping navigation", () => {
    expect(carouselPageCount(5, 2)).toBe(3)

    const clampedCfg = { slideCount: 3, loop: false }
    let s = initialCarouselState(clampedCfg, 0)
    s = reduceCarousel(s, Ev.Previous(), clampedCfg)
    expect(s.index).toBe(0)
    s = reduceCarousel(s, Ev.GoTo({ index: 10 }), clampedCfg)
    expect(s.index).toBe(2)

    const loopCfg = { slideCount: 3, loop: true }
    s = initialCarouselState(loopCfg, 0)
    s = reduceCarousel(s, Ev.Previous(), loopCfg)
    expect(s.index).toBe(2)
    s = reduceCarousel(s, Ev.Next(), loopCfg)
    expect(s.index).toBe(0)
  })

  test("applies rubber-band damping at edges and advances on leftward flick", () => {
    const cfg = { slideCount: 3, loop: false }
    let s = initialCarouselState(cfg, 0)
    s = reduceCarousel(s, Ev.DragStart(), cfg)
    // Rightward drag past index 0 is rubber-banded
    s = reduceCarousel(s, Ev.DragMove({ deltaPx: 200, viewportPx: 400 }), cfg)
    expect(s.dragOffsetPx).toBeGreaterThan(0)
    expect(s.dragOffsetPx).toBeLessThan(200)

    // Leftward flick snaps forward to slide 1 or 2
    s = reduceCarousel(s, Ev.DragMove({ deltaPx: -120, viewportPx: 400 }), cfg)
    s = reduceCarousel(s, Ev.DragEnd({ velocityPxPerSec: -1800, viewportPx: 400 }), cfg)
    expect(s.dragging).toBe(false)
    expect(s.dragOffsetPx).toBe(0)
    expect(s.index).toBeGreaterThan(0)

    // DragCancel aborts drag with zero offset and preserves current index
    const idxBefore = s.index
    s = reduceCarousel(s, Ev.DragStart(), cfg)
    s = reduceCarousel(s, Ev.DragMove({ deltaPx: -180, viewportPx: 400 }), cfg)
    s = reduceCarousel(s, Ev.DragCancel(), cfg)
    expect(s.dragging).toBe(false)
    expect(s.dragOffsetPx).toBe(0)
    expect(s.index).toBe(idxBefore)
  })

  test("suspends autoplay on hover, focus, user pause, and reducedMotion", () => {
    const cfg = { slideCount: 3, autoplay: true }
    let s = initialCarouselState(cfg, 0)
    expect(isCarouselAutoplayActive(s, cfg)).toBe(true)

    s = reduceCarousel(s, Ev.AutoplayTick(), cfg)
    expect(s.index).toBe(1)

    s = reduceCarousel(s, Ev.SetHovered({ hovered: true }), cfg)
    expect(isCarouselAutoplayActive(s, cfg)).toBe(false)
    s = reduceCarousel(s, Ev.AutoplayTick(), cfg)
    expect(s.index).toBe(1)

    s = reduceCarousel(s, Ev.SetHovered({ hovered: false }), cfg)
    s = reduceCarousel(s, Ev.SetFocused({ focused: true }), cfg)
    expect(isCarouselAutoplayActive(s, cfg)).toBe(false)

    s = reduceCarousel(s, Ev.SetFocused({ focused: false }), cfg)
    expect(isCarouselAutoplayActive(s, { ...cfg, reducedMotion: true })).toBe(false)

    s = reduceCarousel(s, Ev.TogglePause(), cfg)
    expect(isCarouselAutoplayActive(s, cfg)).toBe(false)
  })
})
