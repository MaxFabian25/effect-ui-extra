export interface VelocitySample {
  readonly value: number
  readonly timeMs: number
}

export interface VelocityTracker {
  readonly add: (value: number, timeMs: number) => void
  readonly velocity: (nowMs?: number) => number
  readonly reset: () => void
}

/**
 * Tracks smoothed gesture velocity (units per second) over a rolling window,
 * discarding stale samples older than `windowMs`.
 */
export const createVelocityTracker = (windowMs = 120): VelocityTracker => {
  const samples: Array<VelocitySample> = []

  const prune = (nowMs: number) => {
    const cutoff = nowMs - windowMs
    while (samples.length > 0 && samples[0]!.timeMs < cutoff) {
      samples.shift()
    }
  }

  return {
    add: (value, timeMs) => {
      prune(timeMs)
      samples.push({ value, timeMs })
    },
    velocity: (nowMs) => {
      if (samples.length < 2) return 0
      const latest = samples[samples.length - 1]!
      const refTime = nowMs ?? latest.timeMs
      prune(refTime)
      if (samples.length < 2) return 0
      const oldest = samples[0]!
      const newest = samples[samples.length - 1]!
      const dtSec = (newest.timeMs - oldest.timeMs) / 1000
      if (dtSec <= 0) return 0
      return (newest.value - oldest.value) / dtSec
    },
    reset: () => {
      samples.length = 0
    }
  }
}

/**
 * UIScrollView-style momentum projection: returns the additional distance a
 * flick moving at `velocity` (units/s) travels under exponential `deceleration`
 * per millisecond (`0.998` normal, `0.99` fast).
 */
export const projectDistance = (
  velocity: number,
  deceleration = 0.998
): number => {
  const d = Math.min(0.9999, Math.max(0.5, deceleration))
  return (velocity / 1000) * (d / (1 - d))
}

/**
 * Returns the index of the point nearest to `target`.
 */
export const nearestIndex = (
  points: ReadonlyArray<number>,
  target: number
): number => {
  if (points.length === 0) return -1
  let bestIdx = 0
  let bestDist = Math.abs(points[0]! - target)
  for (let i = 1; i < points.length; i++) {
    const dist = Math.abs(points[i]! - target)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  }
  return bestIdx
}

/**
 * Continuous iOS-style rubber-band overscroll resistance. Values inside
 * `[min, max]` pass through unchanged; overshoot outside bounds is damped
 * smoothly toward `dimension`.
 */
export const rubberBand = (
  value: number,
  min: number,
  max: number,
  dimension = 200,
  constant = 0.55
): number => {
  if (value >= min && value <= max) return value
  const dim = Math.max(1, dimension)
  const c = Math.max(0.01, constant)
  const over = value < min ? min - value : value - max
  const damped = (over * c * dim) / (dim + c * over)
  return value < min ? min - damped : max + damped
}

export type SnapPoint = number | `${number}%`

/**
 * Resolves numeric pixel values or percentage strings against `containerSize`,
 * returning sorted ascending pixel offsets.
 */
export const resolveSnapPoints = (
  snapPoints: ReadonlyArray<SnapPoint>,
  containerSize: number
): ReadonlyArray<number> =>
  snapPoints
    .map((sp) =>
      typeof sp === "number"
        ? sp
        : (Number.parseFloat(sp.slice(0, -1)) / 100) * containerSize
    )
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)

/**
 * Picks the target snap index combining current `position` and flick `velocity`
 * via momentum projection.
 */
export const findSnapIndex = (
  position: number,
  velocity: number,
  resolvedPoints: ReadonlyArray<number>,
  deceleration = 0.992
): number => {
  const projected = position + projectDistance(velocity, deceleration)
  return nearestIndex(resolvedPoints, projected)
}
