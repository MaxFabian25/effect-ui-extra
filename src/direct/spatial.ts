export type SpatialDirection = "up" | "down" | "left" | "right"

export interface Rect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export interface SpatialCandidate<K extends string = string> {
  readonly key: K
  readonly rect: Rect
  readonly disabled?: boolean | undefined
}

const centerOf = (r: Rect): readonly [number, number] => [
  (r.left + r.right) / 2,
  (r.top + r.bottom) / 2
]

/**
 * Finds the nearest candidate in `direction` from `origin` using primary-axis
 * progression plus a weighted perpendicular penalty (preferring aligned items
 * over diagonal ones).
 */
export const nearestInDirection = <K extends string>(
  origin: Rect,
  candidates: ReadonlyArray<SpatialCandidate<K>>,
  direction: SpatialDirection,
  excludeKey?: K
): K | undefined => {
  const [ox, oy] = centerOf(origin)
  let bestKey: K | undefined
  let bestScore = Number.POSITIVE_INFINITY

  for (const cand of candidates) {
    if (cand.disabled || cand.key === excludeKey) continue
    const [cx, cy] = centerOf(cand.rect)
    const dx = cx - ox
    const dy = cy - oy

    let primary = 0
    let secondary = 0
    switch (direction) {
      case "right":
        primary = dx
        secondary = Math.abs(dy)
        break
      case "left":
        primary = -dx
        secondary = Math.abs(dy)
        break
      case "down":
        primary = dy
        secondary = Math.abs(dx)
        break
      case "up":
        primary = -dy
        secondary = Math.abs(dx)
        break
    }

    if (primary <= 0.5) continue
    // Weight perpendicular offset more heavily so items on the same row/col win cleanly
    const score = primary + secondary * 2.5
    if (score < bestScore) {
      bestScore = score
      bestKey = cand.key
    }
  }
  return bestKey
}

// ---------------------------------------------------------------------------
// 2D Grid focus navigation
// ---------------------------------------------------------------------------

export interface GridCoord {
  readonly row: number
  readonly col: number
}

export interface GridFocusOptions {
  readonly rows: number
  readonly cols: number
  readonly direction?: "ltr" | "rtl" | undefined
  readonly wrap?: boolean | undefined
  readonly pageSize?: number | undefined
  readonly isDisabled?: ((coord: GridCoord) => boolean) | undefined
}

export type GridMoveKey =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown"

/**
 * Computes the next focusable 2D grid cell for keyboard navigation, honoring
 * LTR/RTL horizontal reversal, disabled cells, `Home`/`End`, `Ctrl+Home`/
 * `Ctrl+End`, `PageUp`/`PageDown`, and optional row wrapping.
 */
export const moveGridFocus = (
  current: GridCoord,
  key: GridMoveKey,
  options: GridFocusOptions,
  modifiers: { readonly ctrl?: boolean | undefined; readonly meta?: boolean | undefined } = {}
): GridCoord => {
  const { cols, rows } = options
  if (rows <= 0 || cols <= 0) return current
  const rtl = options.direction === "rtl"
  const wrap = options.wrap ?? false
  const pageSize = Math.max(1, options.pageSize ?? 5)
  const disabled = options.isDisabled ?? (() => false)
  const mod = modifiers.ctrl === true || modifiers.meta === true

  const clampRow = (r: number) => Math.max(0, Math.min(rows - 1, r))
  const clampCol = (c: number) => Math.max(0, Math.min(cols - 1, c))

  const stepLinear = (startRow: number, startCol: number, delta: number): GridCoord => {
    const total = rows * cols
    let idx = startRow * cols + startCol
    for (let tried = 0; tried < total; tried++) {
      idx += delta
      if (idx < 0 || idx >= total) {
        if (!wrap) return current
        idx = ((idx % total) + total) % total
      }
      const next = { row: Math.floor(idx / cols), col: idx % cols }
      if (!disabled(next)) return next
    }
    return current
  }

  const stepAxis = (dr: number, dc: number): GridCoord => {
    let r = current.row + dr
    let c = current.col + dc
    while (r >= 0 && r < rows && c >= 0 && c < cols) {
      const next = { row: r, col: c }
      if (!disabled(next)) return next
      r += dr
      c += dc
    }
    return current
  }

  switch (key) {
    case "ArrowRight":
      return wrap
        ? stepLinear(current.row, current.col, rtl ? -1 : 1)
        : stepAxis(0, rtl ? -1 : 1)
    case "ArrowLeft":
      return wrap
        ? stepLinear(current.row, current.col, rtl ? 1 : -1)
        : stepAxis(0, rtl ? 1 : -1)
    case "ArrowDown":
      return stepAxis(1, 0)
    case "ArrowUp":
      return stepAxis(-1, 0)
    case "Home": {
      if (mod) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const coord = { row: r, col: c }
            if (!disabled(coord)) return coord
          }
        }
        return current
      }
      for (let c = 0; c < cols; c++) {
        const coord = { row: current.row, col: c }
        if (!disabled(coord)) return coord
      }
      return current
    }
    case "End": {
      if (mod) {
        for (let r = rows - 1; r >= 0; r--) {
          for (let c = cols - 1; c >= 0; c--) {
            const coord = { row: r, col: c }
            if (!disabled(coord)) return coord
          }
        }
        return current
      }
      for (let c = cols - 1; c >= 0; c--) {
        const coord = { row: current.row, col: c }
        if (!disabled(coord)) return coord
      }
      return current
    }
    case "PageDown": {
      const targetRow = clampRow(current.row + pageSize)
      for (let r = targetRow; r < rows; r++) {
        const coord = { row: r, col: clampCol(current.col) }
        if (!disabled(coord)) return coord
      }
      return current
    }
    case "PageUp": {
      const targetRow = clampRow(current.row - pageSize)
      for (let r = targetRow; r >= 0; r--) {
        const coord = { row: r, col: clampCol(current.col) }
        if (!disabled(coord)) return coord
      }
      return current
    }
  }
}
