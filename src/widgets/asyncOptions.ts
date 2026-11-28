import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Predicate from "effect/Predicate"
import * as Ref from "effect/Ref"

export type AsyncOptionsStatus = "idle" | "loading" | "ready" | "error"

export interface AsyncOptionsState<A, E = unknown> {
  readonly query: string
  readonly status: AsyncOptionsStatus
  readonly items: ReadonlyArray<A>
  readonly error: E | undefined
  readonly requestId: number
}

export interface AsyncOptionsLoader<A, E> {
  readonly get: Effect.Effect<AsyncOptionsState<A, E>>
  readonly search: (query: string) => Effect.Effect<void>
  readonly cancel: Effect.Effect<void>
}

export interface AsyncOptionsConfig<A, E> {
  readonly load: (query: string) => Effect.Effect<ReadonlyArray<A>, E>
  readonly debounceMs?: number | undefined
  readonly minQueryLength?: number | undefined
  readonly onChange?: ((state: AsyncOptionsState<A, E>) => void) | undefined
}

/**
 * Effect-native debounced, fiber-interruptible async option loader for
 * `Command`, `Combobox`, and `TriggerMenu`. Rapid `search()` calls interrupt
 * any in-flight fiber and ignore stale completions via monotonic `requestId`.
 * Uses `Effect.sleep` so `TestClock` controls debounce deterministically.
 */
export const makeAsyncOptionsLoader = <A, E = never>(
  config: AsyncOptionsConfig<A, E>
): Effect.Effect<AsyncOptionsLoader<A, E>> =>
  Effect.gen(function*() {
    const debounceMs = Math.max(0, config.debounceMs ?? 150)
    const minQueryLength = Math.max(0, config.minQueryLength ?? 0)

    const stateRef = yield* Ref.make<AsyncOptionsState<A, E>>({
      query: "",
      status: "idle",
      items: [],
      error: undefined,
      requestId: 0
    })
    const activeFiberRef = yield* Ref.make<Fiber.Fiber<void, never> | undefined>(undefined)

    const setState = (next: AsyncOptionsState<A, E>) =>
      Ref.set(stateRef, next).pipe(
        Effect.tap(() => Effect.sync(() => config.onChange?.(next)))
      )

    const interruptActive = Effect.gen(function*() {
      const current = yield* Ref.getAndSet(activeFiberRef, undefined)
      if (current !== undefined) {
        yield* Fiber.interrupt(current)
      }
    })

    const search = (query: string): Effect.Effect<void> =>
      Effect.gen(function*() {
        yield* interruptActive
        const prev = yield* Ref.get(stateRef)
        const requestId = prev.requestId + 1

        if (query.trim().length < minQueryLength) {
          yield* setState({
            query,
            status: "idle",
            items: [],
            error: undefined,
            requestId
          })
          return
        }

        yield* setState({
          query,
          status: "loading",
          items: prev.items,
          error: undefined,
          requestId
        })

        const fiber = yield* Effect.forkDetach(
          Effect.gen(function*() {
            if (debounceMs > 0) {
              yield* Effect.sleep(Duration.millis(debounceMs))
            }
            const result = yield* Effect.result(config.load(query))
            const latest = yield* Ref.get(stateRef)
            if (latest.requestId !== requestId) return

            if (Predicate.isTagged(result, "Success")) {
              yield* setState({
                query,
                status: "ready",
                items: result.success,
                error: undefined,
                requestId
              })
            } else {
              yield* setState({
                query,
                status: "error",
                items: latest.items,
                error: result.failure,
                requestId
              })
            }
          }),
          { startImmediately: true }
        )

        yield* Ref.set(activeFiberRef, fiber)
      })

    const cancel: Effect.Effect<void> = Effect.gen(function*() {
      yield* interruptActive
      const prev = yield* Ref.get(stateRef)
      if (prev.status === "loading") {
        yield* setState({
          ...prev,
          status: prev.items.length > 0 ? "ready" : "idle",
          requestId: prev.requestId + 1
        })
      }
    })

    return {
      get: Ref.get(stateRef),
      search,
      cancel
    }
  })
