export interface TimeSpan {
  readonly id: string
  readonly start: number
  readonly end: number
}

export interface TimeSpanConstraints {
  /** Inclusive lower domain bound. Defaults to `0`. */
  readonly min?: number | undefined
  /** Inclusive upper domain bound. Defaults to `Infinity`. */
  readonly max?: number | undefined
  /** Minimum span duration (`end - start`). Defaults to `1`. */
  readonly minDuration?: number | undefined
  /** Optional grid snap step (`> 0`). */
  readonly step?: number | undefined
}

export const snapTimeValue = (value: number, step?: number): number => {
  if (step === undefined || step <= 0) return value
  return Math.round(value / step) * step
}

/**
 * Translates a span by `delta`, preserving its exact duration while clamping
 * both ends inside `[min, max]` and snapping to `step` when configured.
 */
export const moveTimeSpan = (
  span: TimeSpan,
  delta: number,
  constraints: TimeSpanConstraints = {}
): TimeSpan => {
  const min = constraints.min ?? 0
  const max = constraints.max ?? Number.POSITIVE_INFINITY
  const duration = Math.max(0, span.end - span.start)
  const rawStart = snapTimeValue(span.start + delta, constraints.step)
  const maxStart = Number.isFinite(max) ? Math.max(min, max - duration) : rawStart
  const start = Math.max(min, Math.min(maxStart, rawStart))
  return { id: span.id, start, end: start + duration }
}

/**
 * Moves the start edge of a span by `delta` while enforcing `min`, `minDuration`,
 * and optional `step` snapping.
 */
export const resizeTimeSpanStart = (
  span: TimeSpan,
  delta: number,
  constraints: TimeSpanConstraints = {}
): TimeSpan => {
  const min = constraints.min ?? 0
  const minDuration = Math.max(0, constraints.minDuration ?? 1)
  const rawStart = snapTimeValue(span.start + delta, constraints.step)
  const start = Math.max(min, Math.min(span.end - minDuration, rawStart))
  return { id: span.id, start, end: span.end }
}

/**
 * Moves the end edge of a span by `delta` while enforcing `max`, `minDuration`,
 * and optional `step` snapping.
 */
export const resizeTimeSpanEnd = (
  span: TimeSpan,
  delta: number,
  constraints: TimeSpanConstraints = {}
): TimeSpan => {
  const max = constraints.max ?? Number.POSITIVE_INFINITY
  const minDuration = Math.max(0, constraints.minDuration ?? 1)
  const rawEnd = snapTimeValue(span.end + delta, constraints.step)
  const end = Math.min(max, Math.max(span.start + minDuration, rawEnd))
  return { id: span.id, start: span.start, end }
}

export interface SpanOverlap {
  readonly a: string
  readonly b: string
  readonly overlapStart: number
  readonly overlapEnd: number
}

/**
 * Detects every strictly overlapping pair (`overlapEnd > overlapStart`) across
 * a list of spans. Touching edges (`a.end === b.start`) do not overlap.
 */
export const detectSpanOverlaps = (
  spans: ReadonlyArray<TimeSpan>
): ReadonlyArray<SpanOverlap> => {
  const sorted = [...spans].sort((x, y) => x.start - y.start || x.end - y.end)
  const overlaps: Array<SpanOverlap> = []
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]!
      if (b.start >= a.end) break
      const overlapStart = Math.max(a.start, b.start)
      const overlapEnd = Math.min(a.end, b.end)
      if (overlapEnd > overlapStart) {
        overlaps.push({ a: a.id, b: b.id, overlapStart, overlapEnd })
      }
    }
  }
  return overlaps
}
