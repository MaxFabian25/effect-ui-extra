import type { GridCoord, Rect } from "./spatial.js"

// ---------------------------------------------------------------------------
// 2D Spreadsheet Cell Range Selection
// ---------------------------------------------------------------------------

export interface CellRange {
  readonly anchor: GridCoord
  readonly focus: GridCoord
}

export interface NormalizedCellRange {
  readonly startRow: number
  readonly endRow: number
  readonly startCol: number
  readonly endCol: number
}

export const normalizeCellRange = (range: CellRange): NormalizedCellRange => ({
  startRow: Math.min(range.anchor.row, range.focus.row),
  endRow: Math.max(range.anchor.row, range.focus.row),
  startCol: Math.min(range.anchor.col, range.focus.col),
  endCol: Math.max(range.anchor.col, range.focus.col)
})

export const isCellInRange = (
  range: CellRange | null | undefined,
  cell: GridCoord
): boolean => {
  if (range === null || range === undefined) return false
  const n = normalizeCellRange(range)
  return (
    cell.row >= n.startRow &&
    cell.row <= n.endRow &&
    cell.col >= n.startCol &&
    cell.col <= n.endCol
  )
}

export const cellsInRange = (
  range: CellRange,
  isDisabled?: (coord: GridCoord) => boolean
): ReadonlyArray<GridCoord> => {
  const n = normalizeCellRange(range)
  const out: Array<GridCoord> = []
  for (let r = n.startRow; r <= n.endRow; r++) {
    for (let c = n.startCol; c <= n.endCol; c++) {
      const coord = { row: r, col: c }
      if (isDisabled === undefined || !isDisabled(coord)) {
        out.push(coord)
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Rubber-band Lasso Multi-Selection
// ---------------------------------------------------------------------------

export interface Point {
  readonly x: number
  readonly y: number
}

export interface LassoItem<K extends string = string> {
  readonly key: K
  readonly rect: Rect
  readonly selectable?: boolean | undefined
}

export type LassoMode = "replace" | "add" | "toggle"

export const rectFromPoints = (start: Point, current: Point): Rect => ({
  left: Math.min(start.x, current.x),
  top: Math.min(start.y, current.y),
  right: Math.max(start.x, current.x),
  bottom: Math.max(start.y, current.y)
})

export const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

/**
 * Computes the next selected keys for a rubber-band lasso rectangle over
 * positioned items, supporting `"replace"` (default), `"add"` (`Shift`), and
 * `"toggle"` (`Ctrl`/`Meta`).
 */
export const computeLassoSelection = <K extends string>(
  lassoRect: Rect,
  items: ReadonlyArray<LassoItem<K>>,
  previousSelected: ReadonlyArray<K>,
  mode: LassoMode = "replace"
): ReadonlyArray<K> => {
  const hit: Array<K> = []
  for (const item of items) {
    if (item.selectable === false) continue
    if (rectsIntersect(lassoRect, item.rect)) {
      hit.push(item.key)
    }
  }
  if (mode === "replace") return hit
  if (mode === "add") {
    const out = [...previousSelected]
    const seen = new Set<K>(out)
    for (const k of hit) {
      if (!seen.has(k)) {
        seen.add(k)
        out.push(k)
      }
    }
    return out
  }
  // toggle
  const prevSet = new Set<K>(previousSelected)
  const hitSet = new Set<K>(hit)
  const out: Array<K> = []
  for (const k of previousSelected) {
    if (!hitSet.has(k)) out.push(k)
  }
  for (const k of hit) {
    if (!prevSet.has(k)) out.push(k)
  }
  return out
}
