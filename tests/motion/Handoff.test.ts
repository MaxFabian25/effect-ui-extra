import { describe, expect, test } from "bun:test"
import * as Data from "effect/Data"
import {
  initialScrollHandoffState,
  isAtScrollBottom,
  isAtScrollTop,
  reduceScrollHandoff
} from "../../src/motion/index.js"
import type { ScrollHandoffEvent } from "../../src/motion/index.js"

const Ev = Data.taggedEnum<ScrollHandoffEvent>()

describe("Scroll-to-drag handoff", () => {
  const atTop = { scrollTop: 0, scrollHeight: 800, clientHeight: 400 }
  const scrolledMid = { scrollTop: 120, scrollHeight: 800, clientHeight: 400 }
  const atBottom = { scrollTop: 400, scrollHeight: 800, clientHeight: 400 }

  test("detects scroll boundaries accurately", () => {
    expect(isAtScrollTop(atTop)).toBe(true)
    expect(isAtScrollTop(scrolledMid)).toBe(false)
    expect(isAtScrollBottom(atBottom)).toBe(true)
    expect(isAtScrollBottom(scrolledMid)).toBe(false)
  })

  test("hands off downward pull at scrollTop=0 to sheet drag and returns to scroll past zero", () => {
    let t = reduceScrollHandoff(initialScrollHandoffState, Ev.PointerDown())
    t = reduceScrollHandoff(t.state, Ev.PointerDelta({ deltaY: 18, boundary: atTop }))
    expect(t.state.mode).toBe("drag")
    expect(t.state.dragOffsetPx).toBe(18)
    expect(t.preventDefault).toBe(true)

    t = reduceScrollHandoff(t.state, Ev.PointerDelta({ deltaY: 12, boundary: atTop }))
    expect(t.state.dragOffsetPx).toBe(30)
    expect(t.preventDefault).toBe(true)

    // Pushing back past 0 hands control back to inner scroll
    t = reduceScrollHandoff(t.state, Ev.PointerDelta({ deltaY: -35, boundary: atTop }))
    expect(t.state.mode).toBe("scroll")
    expect(t.state.dragOffsetPx).toBe(0)
    expect(t.preventDefault).toBe(false)

    // Once scrolling, reversing direction in the same touch keeps scrolling smoothly
    t = reduceScrollHandoff(t.state, Ev.PointerDelta({ deltaY: 10, boundary: atTop }))
    expect(t.state.mode).toBe("scroll")
    expect(t.preventDefault).toBe(false)
  })

  test("supports bottom-edge drag handoff for top sheets", () => {
    let t = reduceScrollHandoff(initialScrollHandoffState, Ev.PointerDown())
    t = reduceScrollHandoff(
      t.state,
      Ev.PointerDelta({
        deltaY: -20,
        boundary: atBottom,
        edge: "bottom"
      })
    )
    expect(t.state.mode).toBe("drag")
    expect(t.state.dragOffsetPx).toBe(-20)
    expect(t.preventDefault).toBe(true)

    // PointerCancel resets drag state cleanly
    t = reduceScrollHandoff(t.state, Ev.PointerCancel())
    expect(t.state).toEqual({ mode: "idle", dragOffsetPx: 0 })
    expect(t.preventDefault).toBe(false)
  })
})
