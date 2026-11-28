import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { computeSafePolygon, isPointInSafePolygon } from "../../src/motion/index.js"
import {
  createHistoryStage,
  createMarkRegistry,
  makePageHistory,
  makePageObserver
} from "../../src/page/index.js"

describe("Transactional PageHistory staging and Observe marks", () => {
  it("stages mutations in isolation, discards cleanly, or commits as a batch tracked by marks", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const observer = yield* makePageObserver()
          const history = yield* makePageHistory(observer, { coalesce: false })
          const stage = createHistoryStage()
          const marks = createMarkRegistry()

          const initialSnap = yield* history.snapshot
          marks.mark("before-wizard", initialSnap, "Start of setup wizard", 1000)

          // Stage and discard without touching history
          const reverted: Array<string> = []
          stage.stage({
            id: 1,
            ref: "field-a",
            label: "Field A",
            key: "value",
            previous: "old",
            value: "draft",
            source: "pointer",
            reason: "input",
            committed: true,
            redacted: false
          })
          expect(stage.pending().length).toBe(1)
          expect(stage.discard((c) => reverted.push(c.ref))).toBe(1)
          expect(reverted).toEqual(["field-a"])
          expect((yield* history.snapshot).entries.length).toBe(0)

          // Stage two changes and commit atomically
          stage.stage({
            id: 2,
            ref: "title",
            label: "Title",
            key: "value",
            previous: "Untitled",
            value: "Q4 Plan",
            source: "agent",
            reason: "agent-edit",
            committed: true,
            redacted: false
          })
          stage.stage({
            id: 3,
            ref: "owner",
            label: "Owner",
            key: "value",
            previous: "None",
            value: "Max",
            source: "agent",
            reason: "agent-edit",
            committed: true,
            redacted: false
          })
          const committed = yield* stage.commit(history, "wizard-save")
          expect(committed).toBe(2)

          const afterSnap = yield* history.snapshot
          expect(afterSnap.entries.length).toBe(2)
          expect(afterSnap.entries.every((e) => e.transactionKey === "wizard-save")).toBe(true)

          const since = marks.changesSince("before-wizard", afterSnap)
          expect(since.map((e) => e.ref)).toEqual(["title", "owner"])
          expect(marks.listMarks().length).toBe(1)
        })
      )
    )
  })
})

describe("Popup safePolygon diagonal travel corridor", () => {
  it("accepts diagonal pointer points moving toward the submenu and rejects points outside", () => {
    const origin = { x: 100, y: 100 }
    const popup = { left: 200, top: 40, right: 340, bottom: 260 }

    const poly = computeSafePolygon(origin, popup)
    expect(poly.length).toBe(4)

    // Mid-corridor diagonal move toward bottom of submenu stays open
    expect(isPointInSafePolygon({ x: 150, y: 140 }, origin, popup)).toBe(true)
    // Inside popup stays open
    expect(isPointInSafePolygon({ x: 250, y: 120 }, origin, popup)).toBe(true)
    // Moving away to the left exits the corridor
    expect(isPointInSafePolygon({ x: 40, y: 100 }, origin, popup)).toBe(false)
    // Far above the corridor exits
    expect(isPointInSafePolygon({ x: 150, y: 10 }, origin, popup)).toBe(false)
  })
})
