export interface SectorOptions {
  /** Minimum stroke distance in pixels from center before selecting a sector. Defaults to `18`. */
  readonly deadZone?: number | undefined
  /** Starting rotation offset in turns (`0` = 12 o'clock / up, `0.25` = 3 o'clock / right). Defaults to `0`. */
  readonly start?: number | undefined
}

/**
 * Maps a pointer stroke `(dx, dy)` to one of `count` equal wedges around the
 * origin (`0..count-1` clockwise from 12 o'clock, or `-1` inside `deadZone`).
 * Useful for radial marking menus, reaction pickers, and multi-way flicks.
 */
export const sectorOf = (
  dx: number,
  dy: number,
  count: number,
  options: SectorOptions = {}
): number => {
  const n = Math.floor(count)
  if (n < 1 || Math.hypot(dx, dy) < (options.deadZone ?? 18)) {
    return -1
  }
  const start = options.start ?? 0
  const turn = (Math.atan2(dx, -dy) / (2 * Math.PI) - start + 2) % 1
  return Math.round(turn * n) % n
}

/** Returns the center angle in degrees (clockwise from 12 o'clock) for sector `index` of `count`. */
export const sectorCenterAngleDeg = (
  index: number,
  count: number,
  start = 0
): number => {
  if (count < 1) return 0
  return (((index / count + start) % 1) + 1) % 1 * 360
}
