import { describe, expect, test } from "bun:test"
import {
  carouselPageCount,
  initialCarouselState,
  isCarouselAutoplayActive,
  reduceCarousel
} from "../../src/motion/index.js"

describe("Carousel reducer", () => {
  test("clamps non-looping navigation and wraps looping navigation", () => {
    expect(carouselPageCount(5, 2)).toBe(3)

    const clampedCfg = { slideCount: 3, loop: false }
    let s = initialCarouselState(clampedCfg, 0)
    s = reduceCarousel(s, { _tag: "Previous" }, clampedCfg)
    expect(s.index).toBe(0)
    s = reduceCarousel(s, { _tag: "GoTo", index: 10 }, clampedCfg)
    expect(s.index).toBe(2)

    const loopCfg = { slideCount: 3, loop: true }
    s = initialCarouselState(loopCfg, 0)
    s = reduceCarousel(s, { _tag: "Previous" }, loopCfg)
    expect(s.index).toBe(2)
    s = reduceCarousel(s, { _tag: "Next" }, loopCfg)
    expect(s.index).toBe(0)
  })

  test("applies rubber-band damping at edges and advances on leftward flick", () => {
    const cfg = { slideCount: 3, loop: false }
    let s = initialCarouselState(cfg, 0)
    s = reduceCarousel(s, { _tag: "DragStart" }, cfg)
    // Rightward drag past index 0 is rubber-banded
    s = reduceCarousel(s, { _tag: "DragMove", deltaPx: 200, viewportPx: 400 }, cfg)
    expect(s.dragOffsetPx).toBeGreaterThan(0)
    expect(s.dragOffsetPx).toBeLessThan(200)

    // Leftward flick snaps forward to slide 1 or 2
    s = reduceCarousel(s, { _tag: "DragMove", deltaPx: -120, viewportPx: 400 }, cfg)
    s = reduceCarousel(s, { _tag: "DragEnd", velocityPxPerSec: -1800, viewportPx: 400 }, cfg)
    expect(s.dragging).toBe(false)
    expect(s.dragOffsetPx).toBe(0)
    expect(s.index).toBeGreaterThan(0)
  })

  test("suspends autoplay on hover, focus, user pause, and reducedMotion", () => {
    const cfg = { slideCount: 3, autoplay: true }
    let s = initialCarouselState(cfg, 0)
    expect(isCarouselAutoplayActive(s, cfg)).toBe(true)

    s = reduceCarousel(s, { _tag: "AutoplayTick" }, cfg)
    expect(s.index).toBe(1)

    s = reduceCarousel(s, { _tag: "SetHovered", hovered: true }, cfg)
    expect(isCarouselAutoplayActive(s, cfg)).toBe(false)
    s = reduceCarousel(s, { _tag: "AutoplayTick" }, cfg)
    expect(s.index).toBe(1)

    s = reduceCarousel(s, { _tag: "SetHovered", hovered: false }, cfg)
    s = reduceCarousel(s, { _tag: "SetFocused", focused: true }, cfg)
    expect(isCarouselAutoplayActive(s, cfg)).toBe(false)

    s = reduceCarousel(s, { _tag: "SetFocused", focused: false }, cfg)
    expect(isCarouselAutoplayActive(s, { ...cfg, reducedMotion: true })).toBe(false)

    s = reduceCarousel(s, { _tag: "TogglePause" }, cfg)
    expect(isCarouselAutoplayActive(s, cfg)).toBe(false)
  })
})
