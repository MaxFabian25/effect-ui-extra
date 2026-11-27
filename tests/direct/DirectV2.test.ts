import { describe, expect, test } from "bun:test"
import {
  computeAutoScroll,
  detectSpanOverlaps,
  moveTimeSpan,
  resizeTimeSpanEnd,
  resizeTimeSpanStart,
  snapTimeValue
} from "../../src/direct/index.js"

describe("computeAutoScroll", () => {
  const box = { left: 100, top: 100, right: 500, bottom: 400 }

  test("returns zero velocity inside the safe interior", () => {
    expect(computeAutoScroll({ x: 300, y: 250 }, box)).toEqual({
      dx: 0,
      dy: 0,
      active: false
    })
  })

  test("accelerates smoothly near container edges and stops at scroll limits", () => {
    const nearLeft = computeAutoScroll({ x: 112, y: 250 }, box, { edgePx: 48, maxSpeedPx: 20 })
    const atLeft = computeAutoScroll({ x: 100, y: 250 }, box, { edgePx: 48, maxSpeedPx: 20 })
    expect(nearLeft.active).toBe(true)
    expect(nearLeft.dx).toBeLessThan(0)
    expect(atLeft.dx).toBe(-20)
    expect(Math.abs(atLeft.dx)).toBeGreaterThan(Math.abs(nearLeft.dx))

    const blockedLeft = computeAutoScroll({ x: 100, y: 250 }, box, {
      edgePx: 48,
      maxSpeedPx: 20,
      limits: { scrollLeft: 0, scrollTop: 50, maxScrollLeft: 500, maxScrollTop: 500 }
    })
    expect(blockedLeft).toEqual({ dx: 0, dy: 0, active: false })

    const bottomRight = computeAutoScroll({ x: 500, y: 400 }, box, { edgePx: 40, maxSpeedPx: 16 })
    expect(bottomRight).toEqual({ dx: 16, dy: 16, active: true })
  })
})

describe("TimeSpan manipulation and overlap detection", () => {
  test("moves and resizes spans with clamping, minDuration, and snapping", () => {
    expect(snapTimeValue(17, 15)).toBe(15)
    expect(snapTimeValue(23, 15)).toBe(30)

    const span = { id: "a", start: 10, end: 30 }
    expect(moveTimeSpan(span, 22, { min: 0, max: 50, step: 5 })).toEqual({
      id: "a",
      start: 30,
      end: 50
    })
    expect(moveTimeSpan(span, -50, { min: 0, max: 50 })).toEqual({
      id: "a",
      start: 0,
      end: 20
    })

    expect(resizeTimeSpanStart(span, 25, { min: 0, minDuration: 5 })).toEqual({
      id: "a",
      start: 25,
      end: 30
    })
    expect(resizeTimeSpanEnd(span, -30, { max: 100, minDuration: 5 })).toEqual({
      id: "a",
      start: 10,
      end: 15
    })
  })

  test("detectSpanOverlaps ignores touching edges and reports real overlaps", () => {
    const overlaps = detectSpanOverlaps([
      { id: "a", start: 0, end: 10 },
      { id: "b", start: 10, end: 20 },
      { id: "c", start: 15, end: 25 }
    ])
    expect(overlaps).toEqual([
      { a: "b", b: "c", overlapStart: 15, overlapEnd: 20 }
    ])
  })
})
