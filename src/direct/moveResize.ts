import type { Point } from "./selection.js"

export interface Box2D {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

export interface Move2DOptions {
  /** Grid increment in pixels (`<= 0` disables snapping). */
  readonly grid?: number | undefined
  /** Locks motion to the dominant axis (e.g. while holding `Shift`). */
  readonly lockAxis?: boolean | undefined
  /** Optional bounding box the moved box must stay inside. */
  readonly bounds?: Box2D | undefined
}

const snap = (value: number, grid: number | undefined): number =>
  grid !== undefined && grid > 0 ? Math.round(value / grid) * grid : value

/**
 * Pure 2D free-move step supporting grid snapping, dominant-axis locking
 * (`Shift`), and container bounds clamping.
 */
export const stepMove2D = (
  start: Box2D,
  dx: number,
  dy: number,
  options: Move2DOptions = {}
): Box2D => {
  let effDx = dx
  let effDy = dy
  if (options.lockAxis === true) {
    if (Math.abs(dx) >= Math.abs(dy)) effDy = 0
    else effDx = 0
  }

  let x = snap(start.x + effDx, options.grid)
  let y = snap(start.y + effDy, options.grid)

  if (options.bounds !== undefined) {
    const b = options.bounds
    const maxX = Math.max(b.x, b.x + b.width - start.width)
    const maxY = Math.max(b.y, b.y + b.height - start.height)
    x = Math.max(b.x, Math.min(maxX, x))
    y = Math.max(b.y, Math.min(maxY, y))
  }

  return { x, y, width: start.width, height: start.height }
}

export interface ResizeBoxOptions {
  readonly minWidth?: number | undefined
  readonly minHeight?: number | undefined
  readonly maxWidth?: number | undefined
  readonly maxHeight?: number | undefined
  readonly grid?: number | undefined
  /** Locks the box to `start.width / start.height` (or `aspectRatio` if provided). */
  readonly preserveAspectRatio?: boolean | undefined
  readonly aspectRatio?: number | undefined
  /** Resizes symmetrically around the box center (e.g. while holding `Alt`). */
  readonly fromCenter?: boolean | undefined
  readonly bounds?: Box2D | undefined
}

/**
 * Pure 8-handle 2D box resize supporting minimum/maximum dimensions, grid
 * snapping, aspect-ratio locking, center-anchored resize (`Alt`), and bounds
 * clamping.
 */
export const stepResizeBox = (
  start: Box2D,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  options: ResizeBoxOptions = {}
): Box2D => {
  const minW = Math.max(1, options.minWidth ?? 16)
  const minH = Math.max(1, options.minHeight ?? 16)
  const maxW = options.maxWidth ?? Number.POSITIVE_INFINITY
  const maxH = options.maxHeight ?? Number.POSITIVE_INFINITY
  const scale = options.fromCenter === true ? 2 : 1

  const hasW = handle.includes("w")
  const hasE = handle.includes("e")
  const hasN = handle.includes("n")
  const hasS = handle.includes("s")

  let width = start.width + (hasE ? dx * scale : hasW ? -dx * scale : 0)
  let height = start.height + (hasS ? dy * scale : hasN ? -dy * scale : 0)

  width = Math.max(minW, Math.min(maxW, snap(width, options.grid)))
  height = Math.max(minH, Math.min(maxH, snap(height, options.grid)))

  if (options.preserveAspectRatio === true || options.aspectRatio !== undefined) {
    const ratio = options.aspectRatio ?? (start.height > 0 ? start.width / start.height : 1)
    if (ratio > 0) {
      if ((hasE || hasW) && !(hasN || hasS)) {
        height = Math.max(minH, Math.min(maxH, width / ratio))
        width = height * ratio
      } else if ((hasN || hasS) && !(hasE || hasW)) {
        width = Math.max(minW, Math.min(maxW, height * ratio))
        height = width / ratio
      } else {
        const wDelta = Math.abs(width - start.width)
        const hDelta = Math.abs(height - start.height)
        if (wDelta >= hDelta) {
          height = Math.max(minH, Math.min(maxH, width / ratio))
          width = height * ratio
        } else {
          width = Math.max(minW, Math.min(maxW, height * ratio))
          height = width / ratio
        }
      }
    }
  }

  let x = start.x
  let y = start.y
  if (options.fromCenter === true) {
    x = start.x + (start.width - width) / 2
    y = start.y + (start.height - height) / 2
  } else {
    if (hasW) x = start.x + (start.width - width)
    if (hasN) y = start.y + (start.height - height)
  }

  if (options.bounds !== undefined) {
    const b = options.bounds
    if (x < b.x) {
      if (hasW) width = Math.max(minW, width - (b.x - x))
      x = b.x
    }
    if (y < b.y) {
      if (hasN) height = Math.max(minH, height - (b.y - y))
      y = b.y
    }
    if (x + width > b.x + b.width) {
      width = Math.max(minW, b.x + b.width - x)
    }
    if (y + height > b.y + b.height) {
      height = Math.max(minH, b.y + b.height - y)
    }
  }

  return { x, y, width, height }
}

export interface DragPreviewGeometry {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly transform: string
}

/**
 * Computes clamped floating drag-ghost geometry and its GPU `translate3d(...)`
 * transform from the current pointer position and initial grab offset.
 */
export const computeDragPreview = (input: {
  readonly pointer: Point
  readonly grabOffset: Point
  readonly width: number
  readonly height: number
  readonly viewport?: Box2D | undefined
}): DragPreviewGeometry => {
  let x = input.pointer.x - input.grabOffset.x
  let y = input.pointer.y - input.grabOffset.y
  if (input.viewport !== undefined) {
    const v = input.viewport
    x = Math.max(v.x, Math.min(v.x + v.width - input.width, x))
    y = Math.max(v.y, Math.min(v.y + v.height - input.height, y))
  }
  const tx = Number(x.toFixed(2))
  const ty = Number(y.toFixed(2))
  return {
    x,
    y,
    width: input.width,
    height: input.height,
    transform: `translate3d(${tx}px, ${ty}px, 0)`
  }
}
