import type { Point } from "./selection.js"
import {
  nearestInDirection,
  type Rect,
  type SpatialDirection
} from "./spatial.js"

// ---------------------------------------------------------------------------
// Infinite Canvas Viewport (pan, cursor-pinned zoom, fitBounds)
// ---------------------------------------------------------------------------

export interface Viewport {
  /** Canvas origin offset X on screen in CSS pixels. */
  readonly x: number
  /** Canvas origin offset Y on screen in CSS pixels. */
  readonly y: number
  /** Scale factor (`1` = 100%). */
  readonly zoom: number
}

export interface ZoomBounds {
  readonly minZoom?: number | undefined
  readonly maxZoom?: number | undefined
}

export const screenToCanvas = (point: Point, vp: Viewport): Point => ({
  x: (point.x - vp.x) / vp.zoom,
  y: (point.y - vp.y) / vp.zoom
})

export const canvasToScreen = (point: Point, vp: Viewport): Point => ({
  x: point.x * vp.zoom + vp.x,
  y: point.y * vp.zoom + vp.y
})

export const panViewport = (vp: Viewport, dx: number, dy: number): Viewport => ({
  x: vp.x + dx,
  y: vp.y + dy,
  zoom: vp.zoom
})

/**
 * Zooms `vp` to `targetZoom` while keeping the canvas point under `anchorScreen`
 * pinned to the exact same screen pixel.
 */
export const zoomAtPoint = (
  vp: Viewport,
  targetZoom: number,
  anchorScreen: Point,
  bounds: ZoomBounds = {}
): Viewport => {
  const minZoom = bounds.minZoom ?? 0.1
  const maxZoom = bounds.maxZoom ?? 4
  const nextZoom = Math.max(minZoom, Math.min(maxZoom, targetZoom))
  const world = screenToCanvas(anchorScreen, vp)
  return {
    x: anchorScreen.x - world.x * nextZoom,
    y: anchorScreen.y - world.y * nextZoom,
    zoom: nextZoom
  }
}

/**
 * Fits `contentRect` (in canvas units) centered inside a surface of
 * `surfaceWidth x surfaceHeight` CSS pixels with `padding`.
 */
export const fitBounds = (
  contentRect: Rect,
  surfaceWidth: number,
  surfaceHeight: number,
  padding = 32,
  bounds: ZoomBounds = {}
): Viewport => {
  const minZoom = bounds.minZoom ?? 0.1
  const maxZoom = bounds.maxZoom ?? 4
  const cw = Math.max(1, contentRect.right - contentRect.left)
  const ch = Math.max(1, contentRect.bottom - contentRect.top)
  const availW = Math.max(1, surfaceWidth - padding * 2)
  const availH = Math.max(1, surfaceHeight - padding * 2)
  const zoom = Math.max(minZoom, Math.min(maxZoom, Math.min(availW / cw, availH / ch)))
  const cx = (contentRect.left + contentRect.right) / 2
  const cy = (contentRect.top + contentRect.bottom) / 2
  return {
    x: surfaceWidth / 2 - cx * zoom,
    y: surfaceHeight / 2 - cy * zoom,
    zoom
  }
}

export const viewportTransformCss = (vp: Viewport): string =>
  `translate3d(${vp.x}px, ${vp.y}px, 0) scale(${vp.zoom})`

// ---------------------------------------------------------------------------
// Node-Edge Canvas Connect (port snapping + keyboard spatial targeting)
// ---------------------------------------------------------------------------

export interface CanvasPort {
  readonly id: string
  readonly nodeId: string
  readonly direction: "in" | "out" | "both"
  readonly rect: Rect
}

export interface ConnectDraft {
  readonly from: string
  readonly to: string | null
  readonly x: number
  readonly y: number
  readonly keyboard: boolean
}

export const canConnectPorts = (
  from: CanvasPort,
  to: CanvasPort,
  allowSelfNode = false
): boolean => {
  if (from.id === to.id) return false
  if (!allowSelfNode && from.nodeId === to.nodeId) return false
  if (from.direction === "in" && to.direction === "in") return false
  if (from.direction === "out" && to.direction === "out") return false
  return true
}

/**
 * Snaps a loose connection drag endpoint `(x, y)` to the nearest compatible
 * port within `snapRadius`, or returns `null`.
 */
export const findSnapPort = (
  from: CanvasPort,
  ports: ReadonlyArray<CanvasPort>,
  point: Point,
  snapRadius = 28,
  allowSelfNode = false
): CanvasPort | null => {
  let best: CanvasPort | null = null
  let bestDist = snapRadius
  for (const port of ports) {
    if (!canConnectPorts(from, port, allowSelfNode)) continue
    const cx = (port.rect.left + port.rect.right) / 2
    const cy = (port.rect.top + port.rect.bottom) / 2
    const d = Math.hypot(cx - point.x, cy - point.y)
    if (d <= bestDist) {
      bestDist = d
      best = port
    }
  }
  return best
}

/**
 * Keyboard connection targeting: moves from `currentPort` to the nearest
 * compatible port in `direction` using spatial navigation.
 */
export const nextPortInDirection = (
  from: CanvasPort,
  current: CanvasPort,
  ports: ReadonlyArray<CanvasPort>,
  direction: SpatialDirection,
  allowSelfNode = false
): CanvasPort | undefined => {
  const compatible = ports.filter((p) => canConnectPorts(from, p, allowSelfNode))
  const nextId = nearestInDirection(
    current.rect,
    compatible.map((p) => ({ key: p.id, rect: p.rect })),
    direction,
    current.id
  )
  return nextId === undefined ? undefined : compatible.find((p) => p.id === nextId)
}
