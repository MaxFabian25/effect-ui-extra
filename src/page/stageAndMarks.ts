import * as Effect from "effect/Effect"
import type { HistoryEntry, HistorySnapshot, PageHistoryService } from "./history.js"
import type { ObservedChange } from "./observe.js"

export interface HistoryStage {
  /** Adds a pending change to the isolated staging buffer without touching `PageHistory`. */
  readonly stage: (change: ObservedChange) => void
  /** Returns the currently staged changes in insertion order. */
  readonly pending: () => ReadonlyArray<ObservedChange>
  /**
   * Atomically flushes staged changes into `history` under one shared
   * `transactionKey` bounded by checkpoints so a single undo reverts the batch.
   */
  readonly commit: (
    history: PageHistoryService,
    transactionKey?: string
  ) => Effect.Effect<number>
  /**
   * Discards all staged changes without writing to `PageHistory`. Optional
   * `onRevert` callback runs in reverse order for each staged change so callers
   * can restore local draft state cleanly.
   */
  readonly discard: (onRevert?: (change: ObservedChange) => void) => number
}

/**
 * Creates a transactional staging buffer for multi-step modals, wizards, or AI
 * edit batches that should either commit cleanly or discard without polluting
 * the main `PageHistory` stack.
 */
export const createHistoryStage = (): HistoryStage => {
  let buffer: Array<ObservedChange> = []
  let txSeq = 0

  return {
    stage: (change) => {
      buffer.push(change)
    },
    pending: () => [...buffer],
    commit: (history, transactionKey) =>
      Effect.gen(function*() {
        if (buffer.length === 0) return 0
        const batch = buffer
        buffer = []
        const key = transactionKey ?? `stage-${++txSeq}`
        yield* history.checkpoint
        for (const item of batch) {
          yield* history.record({
            ...item,
            committed: true,
            transactionKey: key
          })
        }
        yield* history.checkpoint
        return batch.length
      }),
    discard: (onRevert) => {
      const count = buffer.length
      if (onRevert !== undefined) {
        for (let i = buffer.length - 1; i >= 0; i--) {
          onRevert(buffer[i]!)
        }
      }
      buffer = []
      return count
    }
  }
}

export interface ObserveMark {
  readonly name: string
  readonly cursor: number
  readonly timestampMs: number
  readonly note?: string | undefined
}

export interface MarkRegistry {
  readonly mark: (name: string, snapshot: HistorySnapshot, note?: string, nowMs?: number) => ObserveMark
  readonly getMark: (name: string) => ObserveMark | undefined
  readonly listMarks: () => ReadonlyArray<ObserveMark>
  /** Returns active history entries recorded after the named mark's cursor. */
  readonly changesSince: (name: string, snapshot: HistorySnapshot) => ReadonlyArray<HistoryEntry>
  readonly clear: () => void
}

/**
 * Tracks named semantic bookmarks over `PageHistory` snapshots so workflows
 * can inspect or summarize every change made since a milestone (for example,
 * `"before-ai-plan"`).
 */
export const createMarkRegistry = (): MarkRegistry => {
  const marks = new Map<string, ObserveMark>()

  return {
    mark: (name, snapshot, note, nowMs = Date.now()) => {
      const entry: ObserveMark = {
        name,
        cursor: snapshot.cursor,
        timestampMs: nowMs,
        ...(note !== undefined ? { note } : {})
      }
      marks.set(name, entry)
      return entry
    },
    getMark: (name) => marks.get(name),
    listMarks: () => [...marks.values()],
    changesSince: (name, snapshot) => {
      const m = marks.get(name)
      if (m === undefined) return []
      const start = Math.max(0, Math.min(m.cursor, snapshot.cursor))
      return snapshot.entries.slice(start, snapshot.cursor).filter((e) => !e.reverted)
    },
    clear: () => {
      marks.clear()
    }
  }
}
