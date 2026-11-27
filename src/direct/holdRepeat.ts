import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"

export interface HoldOptions {
  /** Hold duration before firing. Defaults to `"400 millis"`. */
  readonly delay?: Duration.Input | undefined
}

/**
 * Long-press gesture Effect backed by Effect's `Clock` (100% deterministic
 * under `TestClock`). Interrupting the fiber before `delay` elapses cancels
 * the hold cleanly without invoking `onHold`.
 */
export const holdEffect = <A, E, R>(
  onHold: Effect.Effect<A, E, R>,
  options: HoldOptions = {}
): Effect.Effect<A, E, R> =>
  Effect.sleep(options.delay ?? "400 millis").pipe(Effect.andThen(onHold))

export interface RepeatOptions {
  /** Initial pause after the first tick before repeating starts. Defaults to `"400 millis"`. */
  readonly initialDelay?: Duration.Input | undefined
  /** Starting repeat interval. Defaults to `"100 millis"`. */
  readonly interval?: Duration.Input | undefined
  /** Minimum interval floor when accelerating. Defaults to `"30 millis"`. */
  readonly minInterval?: Duration.Input | undefined
  /** Per-step multiplier (`< 1` accelerates, `1` stays constant). Defaults to `0.9`. */
  readonly acceleration?: number | undefined
  /** Emit tick `0` immediately on press. Defaults to `true`. */
  readonly emitImmediate?: boolean | undefined
}

/**
 * Press-and-hold repeating tick Stream (for spinbuttons, steppers, and
 * continuous buttons), backed by Effect's `Clock` so `TestClock.adjust`
 * drives every tick deterministically.
 */
export const repeatStream = (
  options: RepeatOptions = {}
): Stream.Stream<number> => {
  const initialDelayMs = Math.max(0, Duration.toMillis(options.initialDelay ?? "400 millis"))
  const startIntervalMs = Math.max(1, Duration.toMillis(options.interval ?? "100 millis"))
  const minIntervalMs = Math.max(1, Duration.toMillis(options.minInterval ?? "30 millis"))
  const accel = Math.max(0.1, Math.min(1, options.acceleration ?? 0.9))
  const emitImmediate = options.emitImmediate ?? true

  const repeating = Stream.unfold(
    { tick: emitImmediate ? 1 : 0, waitMs: initialDelayMs, nextIntervalMs: startIntervalMs },
    ({ nextIntervalMs, tick, waitMs }) =>
      Effect.sleep(`${Math.round(waitMs)} millis`).pipe(
        Effect.as([
          tick,
          {
            tick: tick + 1,
            waitMs: nextIntervalMs,
            nextIntervalMs: Math.max(minIntervalMs, nextIntervalMs * accel)
          }
        ] as const)
      )
  )

  return emitImmediate ? Stream.concat(Stream.make(0), repeating) : repeating
}
