export interface VirtualGridConfig {
  readonly rowCount: number
  readonly columnCount: number
  readonly rowHeight: number
  readonly columnWidth: number
  readonly rowGap?: number | undefined
  readonly columnGap?: number | undefined
  readonly overscanRows?: number | undefined
  readonly overscanColumns?: number | undefined
}

export interface VirtualGridViewport {
  readonly scrollTop: number
  readonly scrollLeft: number
  readonly height: number
  readonly width: number
}

export interface VirtualGridCell {
  readonly row: number
  readonly col: number
  readonly top: number
  readonly left: number
  readonly height: number
  readonly width: number
}

export interface VirtualGridLayout {
  readonly totalHeight: number
  readonly totalWidth: number
  readonly startRow: number
  readonly endRow: number
  readonly startCol: number
  readonly endCol: number
  readonly cells: ReadonlyArray<VirtualGridCell>
}

/**
 * Pure 2D multi-column virtualized grid math complementing `@effect/ui-kit`'s
 * single-lane `VirtualList` for spreadsheets, asset galleries, and dense ERP
 * matrices.
 */
export const computeVirtualGrid = (
  config: VirtualGridConfig,
  viewport: VirtualGridViewport
): VirtualGridLayout => {
  const rows = Math.max(0, Math.floor(config.rowCount))
  const cols = Math.max(0, Math.floor(config.columnCount))
  const rowH = Math.max(1, config.rowHeight)
  const colW = Math.max(1, config.columnWidth)
  const rowGap = Math.max(0, config.rowGap ?? 0)
  const colGap = Math.max(0, config.columnGap ?? 0)
  const overscanR = Math.max(0, Math.floor(config.overscanRows ?? 2))
  const overscanC = Math.max(0, Math.floor(config.overscanColumns ?? 2))

  if (rows === 0 || cols === 0) {
    return {
      totalHeight: 0,
      totalWidth: 0,
      startRow: 0,
      endRow: -1,
      startCol: 0,
      endCol: -1,
      cells: []
    }
  }

  const rowStride = rowH + rowGap
  const colStride = colW + colGap
  const totalHeight = rows * rowH + (rows - 1) * rowGap
  const totalWidth = cols * colW + (cols - 1) * colGap

  const scrollTop = Math.max(0, viewport.scrollTop)
  const scrollLeft = Math.max(0, viewport.scrollLeft)
  const vpH = Math.max(0, viewport.height)
  const vpW = Math.max(0, viewport.width)

  const rawStartRow = Math.floor(scrollTop / rowStride)
  const rawEndRow = Math.floor((scrollTop + vpH) / rowStride)
  const startRow = Math.max(0, rawStartRow - overscanR)
  const endRow = Math.min(rows - 1, rawEndRow + overscanR)

  const rawStartCol = Math.floor(scrollLeft / colStride)
  const rawEndCol = Math.floor((scrollLeft + vpW) / colStride)
  const startCol = Math.max(0, rawStartCol - overscanC)
  const endCol = Math.min(cols - 1, rawEndCol + overscanC)

  const cells: Array<VirtualGridCell> = []
  for (let row = startRow; row <= endRow; row++) {
    const top = row * rowStride
    for (let col = startCol; col <= endCol; col++) {
      cells.push({
        row,
        col,
        top,
        left: col * colStride,
        height: rowH,
        width: colW
      })
    }
  }

  return {
    totalHeight,
    totalWidth,
    startRow,
    endRow,
    startCol,
    endCol,
    cells
  }
}
