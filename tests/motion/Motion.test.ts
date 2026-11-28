import { describe, expect, test } from "bun:test"
import * as Data from "effect/Data"
import {
  computeSafePolygon,
  createVelocityTracker,
  findSnapIndex,
  initialPresenceState,
  initialSheetState,
  isPointInSafePolygon,
  nearestIndex,
  projectDistance,
  reducePresence,
  reduceSheet,
  resolveSnapPoints,
  rubberBand,
  settleTime,
  sheetBackdropProgress,
  solveSpring,
  springLinearEasing
} from "../../src/motion/index.js"
import type { PresenceEvent, SheetEvent } from "../../src/motion/index.js"

const SheetEv = Data.taggedEnum<SheetEvent>()
const PresenceEv = Data.taggedEnum<PresenceEvent>()

describe("Analytical spring physics and CSS linear() easing", () => {
  test("underdamped spring overshoots target then settles cleanly at target", () => {
    const cfg = { stiffness: 300, damping: 14, mass: 1 }
    let maxPos = 0
    for (let ms = 0; ms <= 800; ms += 10) {
      const s = solveSpring(ms / 1000, 0, 1, cfg)
      if (s.position > maxPos) maxPos = s.position
    }
    expect(maxPos).toBeGreaterThan(1.05)

    const tSettle = settleTime(cfg)
    expect(tSettle).toBeGreaterThan(200)
    expect(tSettle).toBeLessThan(3000)

    const end = solveSpring(tSettle / 1000, 0, 1, cfg)
    expect(end.done).toBe(true)
    expect(end.position).toBe(1)
  })

  test("critically damped and overdamped springs converge monotonically without overshoot", () => {
    // Critical: damping = 2 * sqrt(k * m) = 2 * sqrt(400) = 40
    const critical = { stiffness: 400, damping: 40, mass: 1 }
    const overdamped = { stiffness: 400, damping: 80, mass: 1 }

    for (const cfg of [critical, overdamped]) {
      const endMs = settleTime(cfg)
      let prev = 0
      for (let ms = 0; ms <= endMs; ms += 10) {
        const s = solveSpring(ms / 1000, 0, 1, cfg)
        expect(s.position).toBeGreaterThanOrEqual(prev - 1e-9)
        expect(s.position).toBeLessThanOrEqual(1 + 1e-6)
        prev = s.position
      }
      expect(solveSpring(endMs / 1000, 0, 1, cfg).position).toBeCloseTo(1, 3)
    }
  })

  test("default spring config is critically damped with zero overshoot", () => {
    const endMs = settleTime()
    let prev = 0
    for (let ms = 0; ms <= endMs; ms += 10) {
      const s = solveSpring(ms / 1000, 0, 1)
      expect(s.position).toBeGreaterThanOrEqual(prev - 1e-9)
      expect(s.position).toBeLessThanOrEqual(1 + 1e-6)
      prev = s.position
    }
    expect(solveSpring(endMs / 1000, 0, 1).position).toBeCloseTo(1, 3)
  })

  test("springLinearEasing emits valid CSS linear(...) curve starting at 0 and ending at 1", () => {
    const css = springLinearEasing({ stiffness: 280, damping: 24 }, 16)
    expect(css.durationMs).toBeGreaterThan(100)
    expect(css.easing.startsWith("linear(0,")).toBe(true)
    expect(css.easing.endsWith(", 1)")).toBe(true)
  })
})

describe("Kinematics: velocity tracker, momentum projection, rubberBand, snap points", () => {
  test("createVelocityTracker tracks recent speed and discards stale samples", () => {
    const tracker = createVelocityTracker(100)
    tracker.add(0, 0)
    tracker.add(50, 50)
    expect(tracker.velocity(50)).toBeCloseTo(1000, 1)

    // Stale sample beyond window
    expect(tracker.velocity(250)).toBe(0)
    tracker.reset()
    expect(tracker.velocity()).toBe(0)
  })

  test("projectDistance, nearestIndex, resolveSnapPoints, and findSnapIndex pick flick targets", () => {
    expect(projectDistance(1000, 0.99)).toBeCloseTo(99, 1)
    expect(nearestIndex([0, 200, 500], 180)).toBe(1)

    const resolved = resolveSnapPoints(["25%", 500, "50%"], 800)
    expect(resolved).toEqual([200, 400, 500])

    // Slow release at 230 stays at 200; strong upward flick at 230 projects to 400 or 500
    expect(findSnapIndex(230, 0, resolved)).toBe(0)
    expect(findSnapIndex(230, 2000, resolved)).toBeGreaterThan(0)
  })

  test("rubberBand passes interior values untouched and damps exterior overshoot smoothly", () => {
    expect(rubberBand(50, 0, 100)).toBe(50)
    const over = rubberBand(200, 0, 100, 200, 0.55)
    expect(over).toBeGreaterThan(100)
    expect(over).toBeLessThan(200)

    const under = rubberBand(-100, 0, 100, 200, 0.55)
    expect(under).toBeLessThan(0)
    expect(under).toBeGreaterThan(-100)
  })
})

describe("Draggable Sheet state machine and Presence lifecycle", () => {
  test("reduceSheet opens, applies rubber-band during over-drag, snaps with velocity, and dismisses", () => {
    const cfg = { snapPoints: [240, 560], dismissible: true }
    let s = initialSheetState(cfg)
    expect(s.phase).toBe("closed")

    s = reduceSheet(s, SheetEv.Open({ snapIndex: 0 }), cfg)
    expect(s).toEqual({ phase: "snapping", position: 240, snapIndex: 0, velocity: 0 })
    s = reduceSheet(s, SheetEv.Settled(), cfg)
    expect(s.phase).toBe("open")
    expect(sheetBackdropProgress(s.position, 560)).toBeCloseTo(240 / 560, 4)

    // Drag up past max -> rubber-band damps overshoot
    s = reduceSheet(s, SheetEv.DragStart({}), cfg)
    s = reduceSheet(s, SheetEv.DragMove({ delta: 400, velocity: 1200 }), cfg)
    expect(s.position).toBeGreaterThan(560)
    expect(s.position).toBeLessThan(640)

    // Flick strongly downward to dismiss
    s = reduceSheet(s, SheetEv.DragMove({ delta: -450, velocity: -2500 }), cfg)
    s = reduceSheet(s, SheetEv.DragEnd({ velocity: -2500 }), cfg)
    expect(s.snapIndex).toBe(-1)
    expect(s.position).toBe(0)
    s = reduceSheet(s, SheetEv.Settled(), cfg)
    expect(s.phase).toBe("closed")
  })

  test("reducePresence animates mount/enter/exit and skips animation phases on reducedMotion", () => {
    let p = initialPresenceState(false)
    expect(p).toEqual({ phase: "unmounted", mounted: false, dataState: "closed" })

    p = reducePresence(p, PresenceEv.SetOpen({ open: true }))
    expect(p).toEqual({ phase: "entering", mounted: true, dataState: "closed" })

    p = reducePresence(p, PresenceEv.EnterFrame())
    expect(p).toEqual({ phase: "open", mounted: true, dataState: "open" })

    p = reducePresence(p, PresenceEv.SetOpen({ open: false }))
    expect(p).toEqual({ phase: "exiting", mounted: true, dataState: "closed" })

    p = reducePresence(p, PresenceEv.AnimationEnd())
    expect(p).toEqual({ phase: "unmounted", mounted: false, dataState: "closed" })

    // Reduced motion jumps straight to open and unmounted by default
    p = reducePresence(p, PresenceEv.SetOpen({ open: true, reducedMotion: true }))
    expect(p).toEqual({ phase: "open", mounted: true, dataState: "open" })
    p = reducePresence(p, PresenceEv.SetOpen({ open: false, reducedMotion: true }))
    expect(p).toEqual({ phase: "unmounted", mounted: false, dataState: "closed" })

    // Opt-in fade mode preserves enter/exit phases for gentle opacity fades
    p = reducePresence(
      p,
      PresenceEv.SetOpen({ open: true, reducedMotion: true, reducedMotionMode: "fade" })
    )
    expect(p).toEqual({ phase: "entering", mounted: true, dataState: "closed" })
    p = reducePresence(p, PresenceEv.EnterFrame())
    p = reducePresence(
      p,
      PresenceEv.SetOpen({ open: false, reducedMotion: true, reducedMotionMode: "fade" })
    )
    expect(p).toEqual({ phase: "exiting", mounted: true, dataState: "closed" })
  })

  test("reduceSheet accumulates undamped rawPosition across drag frames without compounding rubberBand", () => {
    const cfg = { snapPoints: [240, 560], dismissible: true, resistance: 220 }
    let single = reduceSheet(initialSheetState(cfg, 1), SheetEv.DragStart({}), cfg)
    single = reduceSheet(single, SheetEv.DragMove({ delta: 100, velocity: 400 }), cfg)

    let multi = reduceSheet(initialSheetState(cfg, 1), SheetEv.DragStart({}), cfg)
    for (let i = 0; i < 100; i++) {
      multi = reduceSheet(multi, SheetEv.DragMove({ delta: 1, velocity: 400 }), cfg)
    }
    expect(multi.position).toBeCloseTo(single.position, 6)

    // DragMove outside dragging phase is ignored; DragStart accepts live currentPosition
    const open = initialSheetState(cfg, 0)
    expect(reduceSheet(open, SheetEv.DragMove({ delta: 50, velocity: 100 }), cfg)).toEqual(open)
    const caught = reduceSheet(open, SheetEv.DragStart({ currentPosition: 310 }), cfg)
    expect(caught.position).toBe(310)
    expect(caught.rawPosition).toBe(310)

    // DragCancel aborts drag cleanly with zero velocity back to pre-drag snapIndex
    const moved = reduceSheet(caught, SheetEv.DragMove({ delta: -120, velocity: -900 }), cfg)
    const cancelled = reduceSheet(moved, SheetEv.DragCancel(), cfg)
    expect(cancelled).toEqual({ phase: "snapping", position: 240, snapIndex: 0, velocity: 0 })
  })
})

describe("safePolygon grace corridor", () => {
  test("bottom popup corridor is non-self-intersecting and contains diagonal interior points", () => {
    const origin = { x: 200, y: 80 }
    const popup = { left: 100, top: 140, right: 300, bottom: 320 }
    const poly = computeSafePolygon(origin, popup, { side: "bottom" })
    expect(poly.length).toBe(4)

    // Interior points along center and diagonal paths from origin to bottom popup
    expect(isPointInSafePolygon({ x: 200, y: 110 }, origin, popup)).toBe(true)
    expect(isPointInSafePolygon({ x: 160, y: 120 }, origin, popup)).toBe(true)
    expect(isPointInSafePolygon({ x: 240, y: 120 }, origin, popup)).toBe(true)
    // Points outside corridor return false
    expect(isPointInSafePolygon({ x: 200, y: 40 }, origin, popup)).toBe(false)
    expect(isPointInSafePolygon({ x: 60, y: 110 }, origin, popup)).toBe(false)
  })

  test("top popup corridor contains diagonal interior points and rejects outside points", () => {
    const origin = { x: 200, y: 300 }
    const popup = { left: 100, top: 100, right: 300, bottom: 240 }
    expect(isPointInSafePolygon({ x: 200, y: 270 }, origin, popup)).toBe(true)
    expect(isPointInSafePolygon({ x: 160, y: 260 }, origin, popup)).toBe(true)
    expect(isPointInSafePolygon({ x: 240, y: 260 }, origin, popup)).toBe(true)
    expect(isPointInSafePolygon({ x: 200, y: 340 }, origin, popup)).toBe(false)
  })
})
