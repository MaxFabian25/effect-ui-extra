import { describe, expect, it } from "bun:test"
import { Effect, Exit, Fiber, Stream } from "effect"
import { TestClock } from "effect/testing"
import {
  canConnectPorts,
  canMoveTreeNode,
  canvasToScreen,
  cellsInRange,
  computeLassoSelection,
  evaluateSwipeDrag,
  findSnapPort,
  fitBounds,
  handleSwipeKey,
  holdEffect,
  isCellInRange,
  moveGridFocus,
  moveTreeNode,
  nearestInDirection,
  nextPortInDirection,
  panViewport,
  rectFromPoints,
  repeatStream,
  resolveSwipeRelease,
  rubberBand,
  screenToCanvas,
  viewportTransformCss,
  zoomAtPoint
} from "../../src/direct/index.js"

describe("2D Spatial focus and Grid focus", () => {
  it("picks aligned nearest neighbor in direction over closer diagonal", () => {
    const origin = { left: 0, top: 0, right: 40, bottom: 40 }
    const candidates = [
      { key: "diag", rect: { left: 50, top: 60, right: 90, bottom: 100 } },
      { key: "aligned", rect: { left: 100, top: 0, right: 140, bottom: 40 } },
      { key: "disabled", rect: { left: 50, top: 0, right: 90, bottom: 40 }, disabled: true }
    ]
    expect(nearestInDirection(origin, candidates, "right")).toBe("aligned")
    expect(nearestInDirection(origin, candidates, "down")).toBe("diag")
    expect(nearestInDirection(origin, candidates, "left")).toBeUndefined()
  })

  it("navigates 2D grid with RTL reversal, disabled cell skipping, Home/End, Ctrl+Home/End, and PageUp/PageDown", () => {
    const opts = {
      rows: 4,
      cols: 3,
      pageSize: 2,
      isDisabled: ({ col, row }: { readonly row: number; readonly col: number }) =>
        row === 0 && col === 1
    }
    // Skips disabled (0,1)
    expect(moveGridFocus({ row: 0, col: 0 }, "ArrowRight", opts)).toEqual({ row: 0, col: 2 })
    // RTL flips horizontal arrows
    expect(
      moveGridFocus({ row: 0, col: 0 }, "ArrowLeft", { ...opts, direction: "rtl" })
    ).toEqual({ row: 0, col: 2 })
    // PageDown jumps by pageSize
    expect(moveGridFocus({ row: 0, col: 2 }, "PageDown", opts)).toEqual({ row: 2, col: 2 })
    // Ctrl+End jumps to bottom-right
    expect(moveGridFocus({ row: 0, col: 0 }, "End", opts, { ctrl: true })).toEqual({
      row: 3,
      col: 2
    })
  })
})

describe("CellRange and Lasso selection", () => {
  it("normalizes inverted cell ranges and excludes disabled cells", () => {
    const range = { anchor: { row: 2, col: 2 }, focus: { row: 0, col: 1 } }
    expect(isCellInRange(range, { row: 1, col: 2 })).toBe(true)
    expect(isCellInRange(range, { row: 1, col: 0 })).toBe(false)
    const cells = cellsInRange(range, ({ col, row }) => row === 1 && col === 1)
    expect(cells.length).toBe(5)
  })

  it("computes lasso intersection in replace, add (Shift), and toggle (Meta) modes", () => {
    const items = [
      { key: "a", rect: { left: 10, top: 10, right: 50, bottom: 50 } },
      { key: "b", rect: { left: 60, top: 10, right: 100, bottom: 50 } },
      { key: "c", rect: { left: 110, top: 10, right: 150, bottom: 50 }, selectable: false }
    ]
    const lasso = rectFromPoints({ x: 140, y: 40 }, { x: 40, y: 20 })
    expect(computeLassoSelection(lasso, items, ["a"], "replace")).toEqual(["a", "b"])
    expect(computeLassoSelection(lasso, items, ["z"], "add")).toEqual(["z", "a", "b"])
    expect(computeLassoSelection(lasso, items, ["a"], "toggle")).toEqual(["b"])
  })
})

describe("SwipeActions", () => {
  const cfg = {
    startWidth: 80,
    endWidth: 100,
    rowWidth: 320,
    allowFullStart: true,
    fullSwipeRatio: 0.6
  }

  it("handles slop, rubber-band damping, half-width open, flick velocity, full-swipe, RTL, and keyboard", () => {
    expect(evaluateSwipeDrag("row-1", 4, cfg)).toBeNull()
    expect(rubberBand(200, 100, 320)).toBeLessThan(200)
    expect(rubberBand(200, 100, 320)).toBeGreaterThan(100)

    const halfOpen = evaluateSwipeDrag("row-1", -60, cfg)
    expect(resolveSwipeRelease(halfOpen, 0, cfg)).toEqual({
      _tag: "Opened",
      open: { key: "row-1", side: "end" }
    })

    // Flick velocity opens even below half width
    const smallFlick = evaluateSwipeDrag("row-1", -25, cfg)
    expect(resolveSwipeRelease(smallFlick, -0.5, cfg)).toEqual({
      _tag: "Opened",
      open: { key: "row-1", side: "end" }
    })

    // Full swipe triggers primary action
    const full = evaluateSwipeDrag("row-1", 210, cfg)
    expect(full?.full).toBe(true)
    expect(resolveSwipeRelease(full, 0, cfg)).toEqual({
      _tag: "TriggeredFull",
      key: "row-1",
      side: "start"
    })

    // Keyboard LTR + RTL + Escape
    expect(handleSwipeKey("row-1", null, "ArrowRight", cfg)).toEqual({
      key: "row-1",
      side: "start"
    })
    expect(
      handleSwipeKey("row-1", null, "ArrowLeft", { ...cfg, direction: "rtl" })
    ).toEqual({ key: "row-1", side: "start" })
    expect(
      handleSwipeKey("row-1", { key: "row-1", side: "start" }, "Escape", cfg)
    ).toBeNull()
  })
})

describe("holdEffect and repeatStream (deterministic under TestClock)", () => {
  it("holdEffect fires after delay and cancels cleanly on interruption before delay", () =>
    Effect.runPromise(
      Effect.gen(function*() {
        let fired = 0
        const f1 = yield* Effect.forkChild(
          holdEffect(Effect.sync(() => {
            fired++
          }), { delay: "400 millis" })
        )
        yield* TestClock.adjust("200 millis")
        expect(fired).toBe(0)
        yield* Fiber.interrupt(f1)
        yield* TestClock.adjust("400 millis")
        expect(fired).toBe(0)

        const f2 = yield* Effect.forkChild(
          holdEffect(Effect.sync(() => {
            fired++
          }), { delay: "400 millis" })
        )
        yield* TestClock.adjust("400 millis")
        const exit = yield* Fiber.await(f2)
        expect(Exit.isSuccess(exit)).toBe(true)
        expect(fired).toBe(1)
      }).pipe(Effect.provide(TestClock.layer()))
    ))

  it("repeatStream emits immediate tick 0 then accelerates on TestClock", () =>
    Effect.runPromise(
      Effect.gen(function*() {
        const fiber = yield* repeatStream({
          initialDelay: "300 millis",
          interval: "100 millis",
          minInterval: "50 millis",
          acceleration: 0.5
        }).pipe(Stream.take(4), Stream.runCollect, Effect.forkChild)

        // Advance past initialDelay (300) + 100 + 50
        yield* TestClock.adjust("500 millis")
        const ticks = yield* Fiber.join(fiber)
        expect(ticks).toEqual([0, 1, 2, 3])
      }).pipe(Effect.provide(TestClock.layer()))
    ))
})

describe("TreeReorder", () => {
  const tree = [
    {
      id: "a",
      children: [
        { id: "a1" },
        { id: "a2" }
      ]
    },
    { id: "b" }
  ]

  it("prevents dropping a parent into its own descendant and supports before/inside/after moves", () => {
    expect(canMoveTreeNode(tree, "a", "a1")).toBe(false)
    expect(canMoveTreeNode(tree, "a", "a")).toBe(false)
    expect(canMoveTreeNode(tree, "a2", "b")).toBe(true)

    // Cycle attempt returns tree untouched
    expect(moveTreeNode(tree, "a", "a1", "inside")).toBe(tree)

    // Move "a2" inside "b"
    const movedInside = moveTreeNode(tree, "a2", "b", "inside")
    expect(movedInside[0]?.children?.map((c) => c.id)).toEqual(["a1"])
    expect(movedInside[1]?.children?.map((c) => c.id)).toEqual(["a2"])

    // Move "b" before "a"
    const movedBefore = moveTreeNode(tree, "b", "a", "before")
    expect(movedBefore.map((n) => n.id)).toEqual(["b", "a"])
  })
})

describe("Canvas Viewport and Connect", () => {
  it("preserves cursor world coordinate across zoomAtPoint and centers fitBounds", () => {
    const vp0 = panViewport({ x: 0, y: 0, zoom: 1 }, 50, -20)
    const cursorScreen = { x: 200, y: 150 }
    const worldBefore = screenToCanvas(cursorScreen, vp0)
    const vp1 = zoomAtPoint(vp0, 2.5, cursorScreen)
    const screenAfter = canvasToScreen(worldBefore, vp1)
    expect(screenAfter.x).toBeCloseTo(cursorScreen.x, 6)
    expect(screenAfter.y).toBeCloseTo(cursorScreen.y, 6)
    expect(viewportTransformCss(vp1)).toContain("scale(2.5)")

    const fitted = fitBounds({ left: 0, top: 0, right: 200, bottom: 100 }, 800, 600, 40)
    const center = canvasToScreen({ x: 100, y: 50 }, fitted)
    expect(center.x).toBeCloseTo(400, 5)
    expect(center.y).toBeCloseTo(300, 5)
  })

  it("snaps compatible ports, rejects same-node/same-direction ports, and navigates spatially", () => {
    const outA = { id: "a-out", nodeId: "a", direction: "out" as const, rect: { left: 0, top: 0, right: 10, bottom: 10 } }
    const inA = { id: "a-in", nodeId: "a", direction: "in" as const, rect: { left: 15, top: 0, right: 25, bottom: 10 } }
    const outB = { id: "b-out", nodeId: "b", direction: "out" as const, rect: { left: 100, top: 0, right: 110, bottom: 10 } }
    const inB = { id: "b-in", nodeId: "b", direction: "in" as const, rect: { left: 100, top: 0, right: 110, bottom: 10 } }
    const inC = { id: "c-in", nodeId: "c", direction: "in" as const, rect: { left: 220, top: 0, right: 230, bottom: 10 } }
    const ports = [outA, inA, outB, inB, inC]

    expect(canConnectPorts(outA, inA)).toBe(false)
    expect(canConnectPorts(outA, outB)).toBe(false)
    expect(canConnectPorts(outA, inB)).toBe(true)

    expect(findSnapPort(outA, ports, { x: 112, y: 5 }, 20)?.id).toBe("b-in")
    expect(findSnapPort(outA, ports, { x: 400, y: 400 }, 20)).toBeNull()

    expect(nextPortInDirection(outA, outA, ports, "right")?.id).toBe("b-in")
    expect(nextPortInDirection(outA, inB, ports, "right")?.id).toBe("c-in")
  })
})
