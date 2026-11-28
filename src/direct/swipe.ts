import { Data } from "effect"

export type SwipeSide = "start" | "end"

export interface SwipeOpen {
  readonly key: string
  readonly side: SwipeSide
}

export interface SwipeDraft {
  readonly key: string
  /** Visual horizontal offset in px (positive = right, negative = left). */
  readonly x: number
  /** Whether releasing right now triggers the side's primary full-swipe action. */
  readonly full: boolean
  /** Active revealed side implied by drag direction, or `null`. */
  readonly side: SwipeSide | null
}

export interface SwipeConfig {
  readonly startWidth: number
  readonly endWidth: number
  readonly rowWidth: number
  readonly direction?: "ltr" | "rtl" | undefined
  /** Pixel movement before a drag counts as a swipe. Defaults to `8`. */
  readonly slop?: number | undefined
  /** Velocity in px/ms above which a release counts as a flick. Defaults to `0.3`. */
  readonly flickVelocity?: number | undefined
  /** Fraction of `rowWidth` past which releasing runs the primary action (`0..1`). Defaults to `0.65`. */
  readonly fullSwipeRatio?: number | undefined
  readonly allowFullStart?: boolean | undefined
  readonly allowFullEnd?: boolean | undefined
}

/**
 * Hyperbolic rubber-band damping past a limit (iOS-style overscroll resistance).
 */
export const rubberBand = (
  distance: number,
  limit: number,
  dimension: number,
  constant = 0.55
): number => {
  if (Math.abs(distance) <= limit) return distance
  const sign = distance >= 0 ? 1 : -1
  const excess = Math.abs(distance) - limit
  const damped = (excess * dimension * constant) / (dimension + constant * excess)
  return sign * (limit + damped)
}

/**
 * Evaluates a live pointer drag offset for a swipeable row, accounting for
 * RTL mirroring, smooth slop subtraction, rubber-band resistance, and
 * full-swipe threshold.
 */
export const evaluateSwipeDrag = (
  key: string,
  rawDeltaX: number,
  config: SwipeConfig
): SwipeDraft | null => {
  const slop = config.slop ?? 8
  if (Math.abs(rawDeltaX) < slop) return null

  const sign = rawDeltaX >= 0 ? 1 : -1
  const adjustedDeltaX = sign * (Math.abs(rawDeltaX) - slop)

  const rtl = config.direction === "rtl"
  // In LTR: dragging right (+x) reveals "start" actions; dragging left (-x) reveals "end" actions.
  // In RTL: mirrored!
  const revealingStart = rtl ? rawDeltaX < 0 : rawDeltaX > 0
  const side: SwipeSide = revealingStart ? "start" : "end"
  const width = revealingStart ? config.startWidth : config.endWidth
  if (width <= 0) {
    return {
      key,
      x: rubberBand(adjustedDeltaX, 0, Math.max(1, config.rowWidth), 0.15),
      full: false,
      side: null
    }
  }

  const allowFull = revealingStart
    ? (config.allowFullStart ?? false)
    : (config.allowFullEnd ?? false)
  const fullThreshold = config.rowWidth * (config.fullSwipeRatio ?? 0.65)
  const abs = Math.abs(rawDeltaX)
  const full = allowFull && abs >= fullThreshold

  const x = allowFull
    ? rubberBand(adjustedDeltaX, Math.max(1, config.rowWidth), Math.max(1, config.rowWidth))
    : rubberBand(adjustedDeltaX, width, Math.max(1, config.rowWidth))

  return { key, x, full, side }
}

export type SwipeReleaseOutcome =
  | { readonly _tag: "Closed" }
  | { readonly _tag: "Opened"; readonly open: SwipeOpen }
  | { readonly _tag: "TriggeredFull"; readonly key: string; readonly side: SwipeSide }

const SwipeReleaseOutcome = Data.taggedEnum<SwipeReleaseOutcome>()

/**
 * Resolves a swipe gesture on pointer release using offset, flick velocity,
 * and full-swipe threshold.
 */
export const resolveSwipeRelease = (
  draft: SwipeDraft | null,
  velocityPxPerMs: number,
  config: SwipeConfig
): SwipeReleaseOutcome => {
  if (draft === null || draft.side === null) return SwipeReleaseOutcome.Closed()
  if (draft.full) {
    return SwipeReleaseOutcome.TriggeredFull({ key: draft.key, side: draft.side })
  }
  const rtl = config.direction === "rtl"
  const flick = config.flickVelocity ?? 0.3
  const width = draft.side === "start" ? config.startWidth : config.endWidth
  // Positive directional progress in the open direction of `draft.side`
  const openSign =
    draft.side === "start" ? (rtl ? -1 : 1) : rtl ? 1 : -1
  const directedOffset = draft.x * openSign
  const directedVelocity = velocityPxPerMs * openSign

  if (directedVelocity >= flick) {
    return SwipeReleaseOutcome.Opened({ open: { key: draft.key, side: draft.side } })
  }
  if (directedVelocity <= -flick) {
    return SwipeReleaseOutcome.Closed()
  }
  if (directedOffset >= width / 2) {
    return SwipeReleaseOutcome.Opened({ open: { key: draft.key, side: draft.side } })
  }
  return SwipeReleaseOutcome.Closed()
}

/**
 * Keyboard equivalent for swipe-actions rows: Left/Right open or close
 * actions honoring RTL, and Escape closes any open row.
 */
export const handleSwipeKey = (
  rowKey: string,
  currentOpen: SwipeOpen | null,
  key: string,
  config: Pick<SwipeConfig, "startWidth" | "endWidth" | "direction">
): SwipeOpen | null => {
  if (key === "Escape") return null
  const rtl = config.direction === "rtl"
  const isThisOpen = currentOpen?.key === rowKey
  const revealStartKey = rtl ? "ArrowLeft" : "ArrowRight"
  const revealEndKey = rtl ? "ArrowRight" : "ArrowLeft"

  if (key === revealStartKey) {
    if (isThisOpen && currentOpen.side === "end") return null
    return config.startWidth > 0 ? { key: rowKey, side: "start" } : currentOpen
  }
  if (key === revealEndKey) {
    if (isThisOpen && currentOpen.side === "start") return null
    return config.endWidth > 0 ? { key: rowKey, side: "end" } : currentOpen
  }
  return currentOpen
}
