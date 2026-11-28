import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import type { Scope } from "effect/Scope"
import * as Stream from "effect/Stream"
import { PageObserver } from './observe.js';
import type { ChangeSource, ObservedChange, PageObserverService } from './observe.js';

export interface HistoryEntry {
  readonly id: number
  readonly ref: string
  readonly label: string
  readonly key: string
  readonly previous: unknown
  readonly value: unknown
  readonly source: ChangeSource
  readonly reason: string
  readonly redacted: boolean
  readonly reverted: boolean
  readonly transactionKey?: string | undefined
}

export interface HistorySnapshot {
  readonly entries: ReadonlyArray<HistoryEntry>
  /** Number of active entries before the redo tail (0 = start). */
  readonly cursor: number
  readonly canUndo: boolean
  readonly canRedo: boolean
}

export interface HistoryActionResult {
  readonly applied: boolean
  readonly entry?: HistoryEntry | undefined
  readonly skippedRedacted: boolean
  readonly missingTarget: boolean
}

export interface UndoSourceResult {
  readonly source: ChangeSource
  readonly revertedCount: number
  readonly skippedRedacted: ReadonlyArray<HistoryEntry>
  readonly missingTargets: ReadonlyArray<HistoryEntry>
}

export interface PageHistoryOptions {
  /**
   * Fold consecutive edits on the same `ref:key` from the same `source` (and
   * matching `transactionKey` when present) into one undo entry until
   * `checkpoint()` is called. Defaults to `true`.
   */
  readonly coalesce?: boolean | undefined
  /** Maximum number of entries retained. Defaults to `100`. */
  readonly maxEntries?: number | undefined
  /** Restrict history recording to specific keys (e.g. `["value", "checked"]`). */
  readonly keys?: ReadonlyArray<string> | undefined
}

export interface PageHistoryService {
  readonly snapshot: Effect.Effect<HistorySnapshot>
  readonly changes: Stream.Stream<HistorySnapshot>
  /** Explicitly records a committed change (also called automatically when subscribed to `PageObserver`). */
  readonly record: (change: ObservedChange) => Effect.Effect<void>
  /** Starts a fresh undo group so the next edit will not coalesce into the previous entry. */
  readonly checkpoint: Effect.Effect<void>
  /** Steps back one non-reverted entry and restores its `previous` value (never restoring redacted values). */
  readonly undo: Effect.Effect<HistoryActionResult>
  /** Re-applies the next undone entry forward. */
  readonly redo: Effect.Effect<HistoryActionResult>
  /**
   * Reverts every non-reverted entry made by `source` in reverse chronological
   * order, leaving edits by other sources intact and never writing redacted values.
   */
  readonly undoSource: (source: ChangeSource) => Effect.Effect<UndoSourceResult>
  /** Convenience wrapper for `undoSource("agent")`: rolls back every AI agent change. */
  readonly undoAgent: Effect.Effect<UndoSourceResult>
  readonly clear: Effect.Effect<void>
}

export class PageHistory extends Context.Service<
  PageHistory,
  PageHistoryService
>()("effect-ui-page/PageHistory") {}

export const makePageHistory = (
  observer: PageObserverService,
  options: PageHistoryOptions = {}
): Effect.Effect<PageHistoryService, never, Scope> =>
  Effect.gen(function*() {
    const coalesce = options.coalesce ?? true
    const maxEntries = options.maxEntries ?? 100
    const allowedKeys =
      options.keys !== undefined ? new Set(options.keys) : undefined

    let entries: Array<HistoryEntry> = []
    let cursor = 0
    let sealed = false
    const pubsub = yield* PubSub.unbounded<HistorySnapshot>()

    const getSnapshot = (): HistorySnapshot => {
      const canUndo = entries.slice(0, cursor).some((e) => !e.reverted)
      const canRedo = cursor < entries.length
      return {
        entries: [...entries],
        cursor,
        canUndo,
        canRedo
      }
    }

    const notify = () => PubSub.publish(pubsub, getSnapshot()).pipe(Effect.asVoid)

    const record = (change: ObservedChange): Effect.Effect<void> =>
      Effect.gen(function*() {
        if (!change.committed) return
        if (change.source === "history") return
        if (allowedKeys !== undefined && !allowedKeys.has(change.key)) return

        // Drop redo branch on new edit after seeking back
        if (cursor < entries.length) {
          entries = entries.slice(0, cursor)
        }

        const prev = entries[entries.length - 1]
        const canCoalesce =
          coalesce &&
          !sealed &&
          prev !== undefined &&
          !prev.reverted &&
          !prev.redacted &&
          !change.redacted &&
          prev.ref === change.ref &&
          prev.key === change.key &&
          prev.source === change.source &&
          prev.transactionKey === change.transactionKey

        if (canCoalesce) {
          if (Object.is(prev.previous, change.value)) {
            entries.pop()
          } else {
            entries[entries.length - 1] = {
              ...prev,
              id: change.id,
              value: change.value,
              reason: change.reason
            }
          }
        } else {
          entries.push({
            id: change.id,
            ref: change.ref,
            label: change.label,
            key: change.key,
            previous: change.previous,
            value: change.value,
            source: change.source,
            reason: change.reason,
            redacted: change.redacted,
            reverted: false,
            ...(change.transactionKey !== undefined
              ? { transactionKey: change.transactionKey }
              : {})
          })
          if (entries.length > maxEntries) {
            entries = entries.slice(entries.length - maxEntries)
          }
        }

        cursor = entries.length
        sealed = false
        yield* notify()
      })

    // Synchronously attach to observer commits for the lifetime of this Scope (race-free)
    yield* observer.onCommit(record)

    const undo: Effect.Effect<HistoryActionResult> = Effect.gen(function*() {
      let idx = cursor - 1
      while (idx >= 0 && entries[idx]?.reverted === true) {
        idx--
      }
      const entry = idx >= 0 ? entries[idx] : undefined
      if (entry === undefined) {
        return {
          applied: false,
          skippedRedacted: false,
          missingTarget: false
        }
      }
      cursor = idx
      sealed = true

      if (entry.redacted) {
        yield* notify()
        return {
          applied: false,
          entry,
          skippedRedacted: true,
          missingTarget: false
        }
      }

      const ok = yield* observer.restoreTarget(
        entry.ref,
        entry.key,
        entry.previous,
        "undo"
      )
      if (ok) {
        yield* observer.commit({
          ref: entry.ref,
          label: entry.label,
          key: entry.key,
          previous: entry.value,
          value: entry.previous,
          source: "history",
          reason: "undo"
        })
      }
      yield* notify()
      return {
        applied: ok,
        entry,
        skippedRedacted: false,
        missingTarget: !ok
      }
    })

    const redo: Effect.Effect<HistoryActionResult> = Effect.gen(function*() {
      const entry = entries[cursor]
      if (entry === undefined) {
        return {
          applied: false,
          skippedRedacted: false,
          missingTarget: false
        }
      }
      cursor = cursor + 1
      sealed = true

      if (entry.redacted) {
        yield* notify()
        return {
          applied: false,
          entry,
          skippedRedacted: true,
          missingTarget: false
        }
      }

      const ok = yield* observer.restoreTarget(
        entry.ref,
        entry.key,
        entry.value,
        "redo"
      )
      if (ok) {
        yield* observer.commit({
          ref: entry.ref,
          label: entry.label,
          key: entry.key,
          previous: entry.previous,
          value: entry.value,
          source: "history",
          reason: "redo"
        })
      }
      yield* notify()
      return {
        applied: ok,
        entry,
        skippedRedacted: false,
        missingTarget: !ok
      }
    })

    const undoSource = (
      source: ChangeSource
    ): Effect.Effect<UndoSourceResult> =>
      Effect.gen(function*() {
        let revertedCount = 0
        const skippedRedacted: Array<HistoryEntry> = []
        const missingTargets: Array<HistoryEntry> = []

        for (let i = cursor - 1; i >= 0; i--) {
          const entry = entries[i]
          if (entry === undefined || entry.source !== source || entry.reverted) continue

          if (entry.redacted) {
            const updated: HistoryEntry = { ...entry, reverted: true }
            entries[i] = updated
            skippedRedacted.push(updated)
            continue
          }

          const ok = yield* observer.restoreTarget(
            entry.ref,
            entry.key,
            entry.previous,
            "undo"
          )
          if (ok) {
            entries[i] = { ...entry, reverted: true }
            revertedCount++
            yield* observer.commit({
              ref: entry.ref,
              label: entry.label,
              key: entry.key,
              previous: entry.value,
              value: entry.previous,
              source: "history",
              reason: `undo-${source}`
            })
          } else {
            missingTargets.push(entry)
          }
        }

        sealed = true
        yield* notify()
        return {
          source,
          revertedCount,
          skippedRedacted,
          missingTargets
        }
      })

    return {
      snapshot: Effect.sync(getSnapshot),
      changes: Stream.fromPubSub(pubsub),
      record,
      checkpoint: Effect.sync(() => {
        sealed = true
      }),
      undo,
      redo,
      undoSource,
      undoAgent: undoSource("agent"),
      clear: Effect.gen(function*() {
        entries = []
        cursor = 0
        sealed = false
        yield* notify()
      })
    }
  })

/**
 * Provides `PageHistory` wired to an existing `PageObserver`.
 */
export const pageHistoryLayer = (
  options?: PageHistoryOptions
): Layer.Layer<PageHistory, never, PageObserver> =>
  Layer.effect(
    PageHistory,
    PageObserver.use((observer) => makePageHistory(observer, options))
  )
