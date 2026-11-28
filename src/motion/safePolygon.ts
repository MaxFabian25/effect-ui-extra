export interface PolygonPoint {
  readonly x: number
  readonly y: number
}

export interface SafeRect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export type SafePolygonSide = "top" | "bottom" | "left" | "right"

const detectSide = (origin: PolygonPoint, popup: SafeRect): SafePolygonSide => {
  if (origin.x <= popup.left) return "right"
  if (origin.x >= popup.right) return "left"
  if (origin.y <= popup.top) return "bottom"
  return "top"
}

/**
 * Computes a grace corridor polygon bridging a pointer `origin` to the near
 * corners of an open submenu or popup so diagonal mouse motion across sibling
 * items does not prematurely dismiss the popup.
 */
export const computeSafePolygon = (
  origin: PolygonPoint,
  popup: SafeRect,
  options?: {
    readonly side?: SafePolygonSide | undefined
    readonly bufferPx?: number | undefined
  }
): ReadonlyArray<PolygonPoint> => {
  const buf = options?.bufferPx ?? 6
  const side = options?.side ?? detectSide(origin, popup)

  switch (side) {
    case "right":
      return [
        { x: origin.x - buf, y: origin.y - buf },
        { x: popup.left, y: popup.top - buf },
        { x: popup.left, y: popup.bottom + buf },
        { x: origin.x - buf, y: origin.y + buf }
      ]
    case "left":
      return [
        { x: origin.x + buf, y: origin.y - buf },
        { x: popup.right, y: popup.top - buf },
        { x: popup.right, y: popup.bottom + buf },
        { x: origin.x + buf, y: origin.y + buf }
      ]
    case "bottom":
      return [
        { x: origin.x - buf, y: origin.y - buf },
        { x: popup.left - buf, y: popup.top },
        { x: popup.right + buf, y: popup.top },
        { x: origin.x + buf, y: origin.y - buf }
      ]
    case "top":
      return [
        { x: origin.x - buf, y: origin.y + buf },
        { x: popup.left - buf, y: popup.bottom },
        { x: popup.right + buf, y: popup.bottom },
        { x: origin.x + buf, y: origin.y + buf }
      ]
  }
}

/** Standard ray-casting point-in-polygon hit test. */
export const isPointInPolygon = (
  point: PolygonPoint,
  polygon: ReadonlyArray<PolygonPoint>
): boolean => {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]
    const pj = polygon[j]
    if (pi === undefined || pj === undefined) continue
    const xi = pi.x
    const yi = pi.y
    const xj = pj.x
    const yj = pj.y
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/**
 * Returns `true` when `point` lies inside `popup` itself or inside the safe
 * travel corridor from `origin` toward `popup`.
 */
export const isPointInSafePolygon = (
  point: PolygonPoint,
  origin: PolygonPoint,
  popup: SafeRect,
  options?: {
    readonly side?: SafePolygonSide | undefined
    readonly bufferPx?: number | undefined
  }
): boolean => {
  if (
    point.x >= popup.left &&
    point.x <= popup.right &&
    point.y >= popup.top &&
    point.y <= popup.bottom
  ) {
    return true
  }
  return isPointInPolygon(point, computeSafePolygon(origin, popup, options))
}
