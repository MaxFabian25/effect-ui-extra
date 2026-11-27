import { describe, expect, it } from "bun:test"
import { Effect, Layer, Redacted } from "effect"
import {
  PageHistory,
  pageHistoryLayer,
  PageObserver,
  pageObserverLayer,
  REDACTED_PLACEHOLDER
} from "../../src/page/index.js"

const makeLayer = (options?: Parameters<typeof pageHistoryLayer>[0]) =>
  pageHistoryLayer(options).pipe(Layer.provideMerge(pageObserverLayer()))

describe("PageObserver and PageHistory (coalesced Undo/Redo, redaction, and undoAgent)", () => {
  it("coalesces drag steps into one committed change and drops no-op drags", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const observer = yield* PageObserver

          // Slider drag: 20 -> 35 -> 50 -> commit 65
          yield* observer.recordStep({
            ref: "audio/volume",
            label: "Volume",
            key: "value",
            previous: 20,
            value: 35,
            source: "pointer",
            reason: "drag"
          })
          yield* observer.recordStep({
            ref: "audio/volume",
            label: "Volume",
            key: "value",
            previous: 35,
            value: 50,
            source: "pointer",
            reason: "drag"
          })
          const committed = yield* observer.commit({
            ref: "audio/volume",
            label: "Volume",
            key: "value",
            previous: 50,
            value: 65,
            source: "pointer",
            reason: "drag-end"
          })

          expect(committed?.previous).toBe(20)
          expect(committed?.value).toBe(65)

          // Dragging away and back to original value commits nothing
          yield* observer.recordStep({
            ref: "audio/volume",
            label: "Volume",
            key: "value",
            previous: 65,
            value: 90,
            source: "pointer",
            reason: "drag"
          })
          const noop = yield* observer.commit({
            ref: "audio/volume",
            label: "Volume",
            key: "value",
            previous: 90,
            value: 65,
            source: "pointer",
            reason: "drag-end"
          })
          expect(noop).toBeUndefined()

          const log = yield* observer.log
          expect(log.length).toBe(1)
          expect(log[0]?.previous).toBe(20)
          expect(log[0]?.value).toBe(65)
        })
      ).pipe(Effect.provide(pageObserverLayer()))
    ))

  it("supports coalesced undo/redo, checkpoints, branching after seek, and never re-records history changes", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const observer = yield* PageObserver
          const history = yield* PageHistory

          const state: Record<string, unknown> = { title: "Draft", theme: "light" }
          yield* observer.registerTarget("doc/title", (_key, val) =>
            Effect.sync(() => {
              state.title = val
              return true
            })
          )
          yield* observer.registerTarget("prefs/theme", (_key, val) =>
            Effect.sync(() => {
              state.theme = val
              return true
            })
          )

          // Rapid typing edits coalesce into one undo entry
          yield* observer.commit({
            ref: "doc/title",
            label: "Title",
            key: "value",
            previous: "Draft",
            value: "Draft 1",
            source: "keyboard",
            reason: "typing"
          })
          state.title = "Draft 1"
          yield* observer.commit({
            ref: "doc/title",
            label: "Title",
            key: "value",
            previous: "Draft 1",
            value: "Draft 12",
            source: "keyboard",
            reason: "typing"
          })
          state.title = "Draft 12"

          // Checkpoint starts a new undo group
          yield* history.checkpoint
          yield* observer.commit({
            ref: "prefs/theme",
            label: "Theme",
            key: "value",
            previous: "light",
            value: "dark",
            source: "pointer",
            reason: "click"
          })
          state.theme = "dark"

          const snap1 = yield* history.snapshot
          expect(snap1.entries.length).toBe(2)
          expect(snap1.entries[0]?.previous).toBe("Draft")
          expect(snap1.entries[0]?.value).toBe("Draft 12")
          expect(snap1.canUndo).toBe(true)
          expect(snap1.canRedo).toBe(false)

          // Undo theme -> light
          const u1 = yield* history.undo
          expect(u1.applied).toBe(true)
          expect(state.theme).toBe("light")

          // Undo coalesced title -> Draft
          const u2 = yield* history.undo
          expect(u2.applied).toBe(true)
          expect(state.title).toBe("Draft")

          // Redo title -> Draft 12
          const r1 = yield* history.redo
          expect(r1.applied).toBe(true)
          expect(state.title).toBe("Draft 12")

          // Making a new edit after seeking drops the redo branch (theme=dark)
          yield* observer.commit({
            ref: "prefs/theme",
            label: "Theme",
            key: "value",
            previous: "light",
            value: "system",
            source: "pointer",
            reason: "click"
          })
          state.theme = "system"

          const snap2 = yield* history.snapshot
          expect(snap2.entries.length).toBe(2)
          expect(snap2.entries[1]?.value).toBe("system")
          expect(snap2.canRedo).toBe(false)
        })
      ).pipe(Effect.provide(makeLayer()))
    ))

  it("undoAgent() rolls back all AI agent changes in reverse order while preserving user edits and never restoring redacted secrets", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const observer = yield* PageObserver
          const history = yield* PageHistory

          const state: Record<string, unknown> = {
            name: "Initial",
            budget: 100,
            apiKey: "orig-secret",
            note: "user-initial"
          }
          let secretRestoreCalls = 0

          yield* observer.registerTarget("proj/name", (_k, v) =>
            Effect.sync(() => {
              state.name = v
              return true
            })
          )
          yield* observer.registerTarget("proj/budget", (_k, v) =>
            Effect.sync(() => {
              state.budget = v
              return true
            })
          )
          yield* observer.registerTarget("proj/apiKey", (_k, v) =>
            Effect.sync(() => {
              secretRestoreCalls++
              state.apiKey = v
              return true
            })
          )
          yield* observer.registerTarget("proj/note", (_k, v) =>
            Effect.sync(() => {
              state.note = v
              return true
            })
          )

          // 1. User makes a manual edit
          yield* observer.commit({
            ref: "proj/note",
            label: "Note",
            key: "value",
            previous: "user-initial",
            value: "keep-this-user-edit",
            source: "keyboard",
            reason: "typing"
          })
          state.note = "keep-this-user-edit"

          // 2. Agent makes two normal edits + one Schema.Redacted edit
          yield* observer.commit({
            ref: "proj/name",
            label: "Project name",
            key: "value",
            previous: "Initial",
            value: "Agent Renamed",
            source: "agent",
            reason: "agent-action"
          })
          state.name = "Agent Renamed"

          yield* observer.commit({
            ref: "proj/budget",
            label: "Budget",
            key: "value",
            previous: 100,
            value: 500,
            source: "agent",
            reason: "agent-action"
          })
          state.budget = 500

          yield* observer.commit({
            ref: "proj/apiKey",
            label: "API Key",
            key: "value",
            previous: Redacted.make("orig-secret"),
            value: Redacted.make("new-secret-value"),
            source: "agent",
            reason: "agent-action"
          })
          state.apiKey = "new-secret-value"

          // Verify raw secret never entered observer log or history
          const log = yield* observer.log
          const secretEntry = log.find((e) => e.ref === "proj/apiKey")
          expect(secretEntry?.redacted).toBe(true)
          expect(secretEntry?.previous).toBe(REDACTED_PLACEHOLDER)
          expect(secretEntry?.value).toBe(REDACTED_PLACEHOLDER)
          expect(JSON.stringify(log)).not.toContain("new-secret-value")
          expect(JSON.stringify(log)).not.toContain("orig-secret")

          // Roll back all agent actions
          const res = yield* history.undoAgent
          expect(res.revertedCount).toBe(2)
          expect(res.skippedRedacted.length).toBe(1)
          expect(res.missingTargets).toEqual([])

          // Agent's non-secret edits rolled back; user's edit kept; redacted field untouched!
          expect(state.name).toBe("Initial")
          expect(state.budget).toBe(100)
          expect(state.note).toBe("keep-this-user-edit")
          expect(state.apiKey).toBe("new-secret-value")
          expect(secretRestoreCalls).toBe(0)
        })
      ).pipe(Effect.provide(makeLayer()))
    ))
})
