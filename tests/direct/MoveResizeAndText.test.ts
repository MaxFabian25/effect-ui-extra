import { describe, expect, it } from "bun:test"
import {
  computeDragPreview,
  findWordBoundary,
  replaceTextRange,
  stepMove2D,
  stepResizeBox,
  toggleLinePrefix,
  wrapSelection
} from "../../src/direct/index.js"

describe("2D move, 8-handle resize, and drag preview", () => {
  const start = { x: 100, y: 100, width: 200, height: 100 }

  it("moves with grid snap, Shift axis lock, and bounds clamping", () => {
    const snapped = stepMove2D(start, 17, 29, { grid: 10 })
    expect(snapped).toEqual({ x: 120, y: 130, width: 200, height: 100 })

    const locked = stepMove2D(start, 45, 12, { lockAxis: true })
    expect(locked).toEqual({ x: 145, y: 100, width: 200, height: 100 })

    const clamped = stepMove2D(start, 500, -500, {
      bounds: { x: 0, y: 0, width: 400, height: 300 }
    })
    expect(clamped).toEqual({ x: 200, y: 0, width: 200, height: 100 })
  })

  it("resizes from northwest, southeast, center-anchored, and aspect-locked handles", () => {
    const nw = stepResizeBox(start, "nw", -20, -10)
    expect(nw).toEqual({ x: 80, y: 90, width: 220, height: 110 })

    const aspect = stepResizeBox(start, "se", 100, 10, { preserveAspectRatio: true })
    expect(aspect.width).toBe(300)
    expect(aspect.height).toBe(150)

    const centered = stepResizeBox(start, "e", 25, 0, { fromCenter: true })
    expect(centered).toEqual({ x: 75, y: 100, width: 250, height: 100 })

    const minClamped = stepResizeBox(start, "se", -500, -500, { minWidth: 40, minHeight: 30 })
    expect(minClamped.width).toBe(40)
    expect(minClamped.height).toBe(30)
  })

  it("computes clamped floating drag preview geometry", () => {
    const ghost = computeDragPreview({
      pointer: { x: 490, y: 20 },
      grabOffset: { x: 10, y: 30 },
      width: 120,
      height: 40,
      viewport: { x: 0, y: 0, width: 500, height: 400 }
    })
    expect(ghost.x).toBe(380)
    expect(ghost.y).toBe(0)
    expect(ghost.transform).toBe("translate3d(380px, 0px, 0)")

    const subpixel = computeDragPreview({
      pointer: { x: 120.756, y: 45.254 },
      grabOffset: { x: 10.5, y: 5.1 },
      width: 100,
      height: 40
    })
    expect(subpixel.transform).toBe("translate3d(110.26px, 40.15px, 0)")
  })
})

describe("textEditor caret-preserving helpers", () => {
  it("replaces ranges, wraps selections, navigates word boundaries, and toggles line prefixes", () => {
    const rep = replaceTextRange("Hello world", 6, 11, "Effect")
    expect(rep).toEqual({ value: "Hello Effect", selectionStart: 12, selectionEnd: 12 })

    const wrapped = wrapSelection("Make bold text", 5, 9, "**")
    expect(wrapped).toEqual({ value: "Make **bold** text", selectionStart: 7, selectionEnd: 11 })

    expect(findWordBoundary("alpha beta-gamma", 16, "backward")).toBe(11)
    expect(findWordBoundary("alpha beta-gamma", 0, "forward")).toBe(5)

    const prefixed = toggleLinePrefix("one\ntwo\nthree", 0, 7, "- ")
    expect(prefixed.value).toBe("- one\n- two\nthree")
    const unprefixed = toggleLinePrefix(prefixed.value, 0, 11, "- ")
    expect(unprefixed.value).toBe("one\ntwo\nthree")
  })
})
