import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Redacted from "effect/Redacted"
import type { Scope } from "effect/Scope"
import * as Stream from "effect/Stream"

export type ChangeSource =
  | "pointer"
  | "keyboard"
  | "agent"
  | "programmatic"
  | "history"

export const REDACTED_PLACEHOLDER = "[redacted]" as const

export interface RecordChangeInput {
  readonly ref: string
  readonly label: string
  readonly key: string
  readonly previous: unknown
  readonly value: unknown
  readonly source: ChangeSource
  readonly reason: string
  /** Force redaction even for plain strings (e.g. password/card/OTP inputs). */
  readonly secret?: boolean | undefined
  /** Optional transaction grouping key for coalescing. */
  readonly transactionKey?: string | undefined
}

export interface ObservedChange {
  readonly id: number
  readonly ref: string
  readonly label: string
  readonly key: string
  readonly previous: unknown
  readonly value: unknown
  readonly source: ChangeSource
  readonly reason: string
  readonly redacted: boolean
  readonly committed: boolean
  readonly transactionKey?: string | undefined
}

export type RestoreHandler = (
  key: string,
  value: unknown,
  reason: "undo" | "redo"
) => Effect.Effect<boolean>

export interface PageObserverService {
  /**
   * Records an intermediate live step (such as slider dragging or rapid typing)
   * without committing a history entry yet. Holds the original `previous` value
   * from the start of the interaction until `commit()` runs.
   */
  readonly recordStep: (input: RecordChangeInput) => Effect.Effect<ObservedChange>
  /**
   * Commits a semantic change. If an intermediate live step was staged for the
   * same `ref:key`, folds the entire interaction into one committed entry with
   * the pre-interaction `previous` value. Returns `undefined` when the final
   * value equals the original `previous` value (a no-op drag).
   */
  readonly commit: (
    input: RecordChangeInput
  ) => Effect.Effect<ObservedChange | undefined>
  /** Registers a scoped restore handler for `ref` so `PageHistory` can undo/redo it. */
  readonly registerTarget: (
    ref: string,
    restore: RestoreHandler
  ) => Effect.Effect<void, never, Scope>
  /** Registers a scoped synchronous commit listener that runs inside `commit()`. */
  readonly onCommit: (
    listener: (change: ObservedChange) => Effect.Effect<void>
  ) => Effect.Effect<void, never, Scope>
  /** Invokes the registered restore handler for `ref`, returning `false` if absent. */
  readonly restoreTarget: (
    ref: string,
    key: string,
    value: unknown,
    reason: "undo" | "redo"
  ) => Effect.Effect<boolean>
  /** Stream of committed semantic changes (one per completed interaction). */
  readonly committedChanges: Stream.Stream<ObservedChange>
  /** Stream of all live and committed changes (including intermediate drag steps). */
  readonly liveChanges: Stream.Stream<ObservedChange>
  /** Snapshot of all committed changes recorded so far. */
  readonly log: Effect.Effect<ReadonlyArray<ObservedChange>>
  /** Clears staged steps and the committed audit log. */
  readonly clearLog: Effect.Effect<void>
}

export class PageObserver extends Context.Service<
  PageObserver,
  PageObserverService
>()("effect-ui-page/PageObserver") {}

interface StagedEntry {
  readonly initialPrevious: unknown
  readonly redacted: boolean
}

const isSecretValue = (input: RecordChangeInput): boolean =>
  input.secret === true ||
  Redacted.isRedacted(input.value) ||
  Redacted.isRedacted(input.previous)

const sanitize = (value: unknown, redacted: boolean): unknown =>
  redacted ? REDACTED_PLACEHOLDER : value

export const makePageObserver = (): Effect.Effect<PageObserverService> =>
  Effect.gen(function*() {
    let seq = 0
    const staged = new Map<string, StagedEntry>()
    const targets = new Map<string, RestoreHandler>()
    const commitListeners = new Set<(change: ObservedChange) => Effect.Effect<void>>()
    const committedLog: Array<ObservedChange> = []
    const committedPubSub = yield* PubSub.unbounded<ObservedChange>()
    const livePubSub = yield* PubSub.unbounded<ObservedChange>()

    const stageKey = (ref: string, key: string) => `${ref}::${key}`

    const recordStep = (
      input: RecordChangeInput
    ): Effect.Effect<ObservedChange> =>
      Effect.gen(function*() {
        const redacted = isSecretValue(input)
        const sk = stageKey(input.ref, input.key)
        const existing = staged.get(sk)
        if (existing === undefined) {
          staged.set(sk, {
            initialPrevious: sanitize(input.previous, redacted),
            redacted
          })
        } else if (redacted && !existing.redacted) {
          staged.set(sk, {
            initialPrevious: REDACTED_PLACEHOLDER,
            redacted: true
          })
        }
        const entry: ObservedChange = {
          id: ++seq,
          ref: input.ref,
          label: input.label,
          key: input.key,
          previous: sanitize(input.previous, redacted),
          value: sanitize(input.value, redacted),
          source: input.source,
          reason: input.reason,
          redacted,
          committed: false,
          ...(input.transactionKey !== undefined
            ? { transactionKey: input.transactionKey }
            : {})
        }
        yield* PubSub.publish(livePubSub, entry)
        return entry
      })

    const commit = (
      input: RecordChangeInput
    ): Effect.Effect<ObservedChange | undefined> =>
      Effect.gen(function*() {
        const sk = stageKey(input.ref, input.key)
        const pending = staged.get(sk)
        staged.delete(sk)
        const redacted = isSecretValue(input) || (pending?.redacted ?? false)
        const prev =
          pending !== undefined
            ? sanitize(pending.initialPrevious, redacted)
            : sanitize(input.previous, redacted)
        const next = sanitize(input.value, redacted)

        // Drop no-op non-redacted commits (e.g. slider dragged back to start)
        if (!redacted && Object.is(prev, next)) {
          return undefined
        }

        const entry: ObservedChange = {
          id: ++seq,
          ref: input.ref,
          label: input.label,
          key: input.key,
          previous: prev,
          value: next,
          source: input.source,
          reason: input.reason,
          redacted,
          committed: true,
          ...(input.transactionKey !== undefined
            ? { transactionKey: input.transactionKey }
            : {})
        }
        committedLog.push(entry)
        for (const listener of commitListeners) {
          yield* listener(entry)
        }
        yield* PubSub.publish(livePubSub, entry)
        yield* PubSub.publish(committedPubSub, entry)
        return entry
      })

    const registerTarget = (
      ref: string,
      restore: RestoreHandler
    ): Effect.Effect<void, never, Scope> =>
      Effect.acquireRelease(
        Effect.sync(() => {
          targets.set(ref, restore)
        }),
        () =>
          Effect.sync(() => {
            if (targets.get(ref) === restore) {
              targets.delete(ref)
            }
          })
      )

    const restoreTarget = (
      ref: string,
      key: string,
      value: unknown,
      reason: "undo" | "redo"
    ): Effect.Effect<boolean> =>
      Effect.suspend(() => {
        const handler = targets.get(ref)
        if (handler === undefined) return Effect.succeed(false)
        return handler(key, value, reason)
      })

    const onCommit = (
      listener: (change: ObservedChange) => Effect.Effect<void>
    ): Effect.Effect<void, never, Scope> =>
      Effect.acquireRelease(
        Effect.sync(() => {
          commitListeners.add(listener)
        }),
        () =>
          Effect.sync(() => {
            commitListeners.delete(listener)
          })
      )

    return {
      recordStep,
      commit,
      registerTarget,
      onCommit,
      restoreTarget,
      committedChanges: Stream.fromPubSub(committedPubSub),
      liveChanges: Stream.fromPubSub(livePubSub),
      log: Effect.sync(() => [...committedLog]),
      clearLog: Effect.sync(() => {
        staged.clear()
        committedLog.length = 0
      })
    }
  })

export const pageObserverLayer = (): Layer.Layer<PageObserver> =>
  Layer.effect(PageObserver, makePageObserver())
