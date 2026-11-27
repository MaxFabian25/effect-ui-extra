import type { Point } from "./selection.js"
import type { Rect } from "./spatial.js"

export interface AutoScrollLimits {
  readonly scrollLeft: number
  readonly scrollTop: number
  readonly maxScrollLeft: number
  readonly maxScrollTop: number
}

export interface AutoScrollOptions {
  /** Edge zone thickness in pixels where auto-scrolling activates. Defaults to `48`. */
  readonly edgePx?: number | undefined
  /** Maximum scroll delta in pixels per frame at the outer boundary. Defaults to `18`. */
  readonly maxSpeedPx?: number | undefined
  /** Optional current scroll offsets so zero velocity is returned when already at a boundary. */
  readonly limits?: AutoScrollLimits | undefined
}

export interface AutoScrollVelocity {
  readonly dx: number
  readonly dy: number
  readonly active: boolean
}

const edgeDelta = (
  coord: number,
  start: number,
  end: number,
  edgePx: number,
  maxSpeedPx: number,
  canNeg: boolean,
  canPos: boolean
): number => {
  if (edgePx <= 0 || maxSpeedPx <= 0) return 0
  const distStart = coord - start
  if (distStart < edgePx && canNeg) {
    const ratio = Math.min(1, Math.max(0, (edgePx - distStart) / edgePx))
    return -Math.round(ratio * ratio * maxSpeedPx * 100) / 100
  }
  const distEnd = end - coord
  if (distEnd < edgePx && canPos) {
    const ratio = Math.min(1, Math.max(0, (edgePx - distEnd) / edgePx))
    return Math.round(ratio * ratio * maxSpeedPx * 100) / 100
  }
  return 0
}

/**
 * Computes smooth quadratic edge-proximity auto-scroll velocity while a user
 * drags or lasso-selects near the edge of a scrollable container.
 */
export const computeAutoScroll = (
  pointer: Point,
  container: Rect,
  options: AutoScrollOptions = {}
): AutoScrollVelocity => {
  const edgePx = options.edgePx ?? 48
  const maxSpeedPx = options.maxSpeedPx ?? 18
  const limits = options.limits

  const canLeft = limits === undefined ? true : limits.scrollLeft > 0
  const canRight =
    limits === undefined ? true : limits.scrollLeft < limits.maxScrollLeft
  const canUp = limits === undefined ? true : limits.scrollTop > 0
  const canDown =
    limits === undefined ? true : limits.scrollTop < limits.maxScrollTop

  const dx = edgeDelta(
    pointer.x,
    container.left,
    container.right,
    edgePx,
    maxSpeedPx,
    canLeft,
    canRight
  )
  const dy = edgeDelta(
    pointer.y,
    container.top,
    container.bottom,
    edgePx,
    maxSpeedPx,
    canUp,
    canDown
  )

  return { dx, dy, active: dx !== 0 || dy !== 0 }
}
