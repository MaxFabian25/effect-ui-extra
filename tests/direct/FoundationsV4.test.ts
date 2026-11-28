import { describe, expect, test } from "bun:test"
import {
  addDays,
  cancelDraftMove,
  commitDraftMove,
  comparePlainDates,
  computeVirtualGrid,
  firstDayOfWeek,
  formatLocalizedNumber,
  formatPlainDate,
  initialDraftMove,
  parseLocalizedNumber,
  parsePlainDate,
  ratioToValue,
  snapToStep,
  startDraftMove,
  syncDraftMoveCommitted,
  updateDraftMove,
  valueToRatio
} from "../../src/direct/index.js"
import { sectorCenterAngleDeg, sectorOf } from "../../src/motion/index.js"
import { deltaEOK, isPerceptuallyDistinct, resolveCssNamedColor } from "../../src/theme/index.js"

describe("Theme compare and CSS named colors", () => {
  test("resolves CSS Color 4 names and measures Oklab deltaEOK", () => {
    expect(resolveCssNamedColor("RebeccaPurple")).toBe("#663399")
    expect(resolveCssNamedColor("notacolor")).toBeUndefined()
    expect(deltaEOK("white", "#ffffff")).toBeCloseTo(0, 5)
    expect(isPerceptuallyDistinct("#ffffff", "#ffffff")).toBe(false)
    expect(isPerceptuallyDistinct("rebeccapurple", "tomato")).toBe(true)
  })
})

describe("Motion radial sectorOf", () => {
  test("maps pointer deltas clockwise from 12 o'clock with deadZone", () => {
    expect(sectorOf(3, 4, 4)).toBe(-1)
    expect(sectorOf(0, -30, 4)).toBe(0) // up
    expect(sectorOf(30, 0, 4)).toBe(1) // right
    expect(sectorOf(0, 30, 4)).toBe(2) // down
    expect(sectorOf(-30, 0, 4)).toBe(3) // left
    expect(sectorCenterAngleDeg(1, 4)).toBe(90)
  })
})

describe("NumberScale and localized number parsing", () => {
  test("maps linear, log, and custom scales cleanly and parses locale numbers", () => {
    expect(valueToRatio(100, 10, 1000, "log")).toBeCloseTo(0.5, 5)
    expect(ratioToValue(0.5, 10, 1000, "log")).toBeCloseTo(100, 5)
    expect(snapToStep(0.37, 0, 1, 0.1)).toBe(0.4)

    expect(formatLocalizedNumber(1234.5, "en-US")).toBe("1,234.5")
    expect(parseLocalizedNumber("1,234.56", "en-US")).toBe(1234.56)
    expect(parseLocalizedNumber("1.234,56", "da-DK")).toBe(1234.56)
    expect(parseLocalizedNumber("25%", "en-US")).toBe(0.25)
    expect(parseLocalizedNumber("abc", "en-US")).toBeUndefined()
  })
})

describe("DraftMove optimistic drag-over state machine", () => {
  test("previews draft moves, rolls back on cancel, and commits changes", () => {
    const idle = initialDraftMove(["a", "b", "c"])
    const started = startDraftMove(idle, "a", "pointer")
    const moved = updateDraftMove(started, ["b", "a", "c"])
    expect(moved.committed).toEqual(["a", "b", "c"])
    expect(moved.draft).toEqual(["b", "a", "c"])

    const cancelled = cancelDraftMove(moved)
    expect(cancelled.active).toBe(false)
    expect(cancelled.draft).toEqual(["a", "b", "c"])

    const committed = commitDraftMove(moved, (a, b) => a.join(",") === b.join(","))
    expect(committed.changed).toBe(true)
    expect(committed.value).toEqual(["b", "a", "c"])
    expect(committed.source).toBe("pointer")

    const synced = syncDraftMoveCommitted(committed.state, ["x", "y"])
    expect(synced.draft).toEqual(["x", "y"])
  })
})

describe("VirtualGrid 2D windowing math", () => {
  test("computes visible 2D cell slice with overscan and gaps", () => {
    const layout = computeVirtualGrid(
      {
        rowCount: 1000,
        columnCount: 50,
        rowHeight: 32,
        columnWidth: 100,
        rowGap: 4,
        columnGap: 8,
        overscanRows: 1,
        overscanColumns: 1
      },
      { scrollTop: 360, scrollLeft: 216, height: 108, width: 216 }
    )
    expect(layout.totalHeight).toBe(1000 * 32 + 999 * 4)
    expect(layout.totalWidth).toBe(50 * 100 + 49 * 8)
    expect(layout.startRow).toBe(9)
    expect(layout.startCol).toBe(1)
    expect(layout.cells.length).toBe(
      (layout.endRow - layout.startRow + 1) * (layout.endCol - layout.startCol + 1)
    )
    expect(layout.cells[0]).toEqual({
      row: 9,
      col: 1,
      top: 9 * 36,
      left: 1 * 108,
      height: 32,
      width: 100
    })
  })
})

describe("CLDR firstDayOfWeek and PlainDate math", () => {
  test("resolves CLDR regions, -u-fw- overrides, and ISO PlainDate arithmetic", () => {
    expect(firstDayOfWeek("en-US")).toBe(0)
    expect(firstDayOfWeek("da-DK")).toBe(1)
    expect(firstDayOfWeek("ar-EG")).toBe(6)
    expect(firstDayOfWeek("dv-MV")).toBe(5)
    expect(firstDayOfWeek("en-US-u-fw-mon")).toBe(1)

    const d = parsePlainDate("2026-02-28")!
    expect(d).toEqual({ year: 2026, month: 2, day: 28 })
    expect(parsePlainDate("2026-02-29")).toBeUndefined() // 2026 is not a leap year
    const next = addDays(d, 1)
    expect(formatPlainDate(next)).toBe("2026-03-01")
    expect(comparePlainDates(d, next)).toBe(-1)
  })
})
