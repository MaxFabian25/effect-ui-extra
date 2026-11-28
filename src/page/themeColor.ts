import { oklchToSrgb, parseColor } from "../theme/color.js"

interface Rgb {
  readonly r: number
  readonly g: number
  readonly b: number
}

const parseRgbOrHex = (input: string): Rgb | undefined => {
  const s = input.trim().toLowerCase()
  if (s.startsWith("#")) {
    const hex = s.slice(1)
    if (hex.length === 3) {
      const r = Number.parseInt(hex[0]! + hex[0]!, 16)
      const g = Number.parseInt(hex[1]! + hex[1]!, 16)
      const b = Number.parseInt(hex[2]! + hex[2]!, 16)
      return [r, g, b].some(Number.isNaN) ? undefined : { r, g, b }
    }
    if (hex.length === 6) {
      const r = Number.parseInt(hex.slice(0, 2), 16)
      const g = Number.parseInt(hex.slice(2, 4), 16)
      const b = Number.parseInt(hex.slice(4, 6), 16)
      return [r, g, b].some(Number.isNaN) ? undefined : { r, g, b }
    }
    return undefined
  }
  const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(s)
  if (match !== null) {
    const r = Number.parseFloat(match[1]!)
    const g = Number.parseFloat(match[2]!)
    const b = Number.parseFloat(match[3]!)
    return [r, g, b].some(Number.isNaN) ? undefined : { r, g, b }
  }
  const parsed = parseColor(input)
  if (parsed === undefined) return undefined
  const srgb = oklchToSrgb(parsed)
  return { r: srgb.r * 255, g: srgb.g * 255, b: srgb.b * 255 }
}

const toHex = ({ b, g, r }: Rgb): string => {
  const byte = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0")
  return `#${byte(r)}${byte(g)}${byte(b)}`
}

/**
 * Blends a `#rrggbb` or `rgb(...)` theme color toward black by
 * `clamp01(dim) * clamp01(alpha)`, matching a modal or sheet backdrop overlay.
 */
export const blendThemeColor = (
  baseColor: string,
  dim: number,
  alpha = 0.45
): string | undefined => {
  const rgb = parseRgbOrHex(baseColor)
  if (rgb === undefined) return undefined
  const shade = Math.max(0, Math.min(1, dim)) * Math.max(0, Math.min(1, alpha))
  const keep = 1 - shade
  return toHex({
    r: rgb.r * keep,
    g: rgb.g * keep,
    b: rgb.b * keep
  })
}

export interface ThemeColorDimmer {
  readonly write: (dim: number) => void
  readonly restore: () => void
}

/**
 * Dims existing `<meta name="theme-color">` tags in `doc` so mobile browser
 * chrome darkens with an open modal or sheet backdrop. Writes only when the
 * rounded shade changes (avoiding expensive per-frame Safari chrome re-tints),
 * and leaves pages without a `theme-color` meta tag untouched.
 */
export const createThemeColorDimmer = (
  doc: Pick<Document, "querySelectorAll">,
  alpha = 0.45
): ThemeColorDimmer => {
  let metas: Array<HTMLMetaElement> = []
  let originals: Array<string> = []
  let active = false
  let lastShade = -1

  return {
    write: (dim: number) => {
      if (!active) {
        metas = Array.from(
          doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
        )
        originals = metas.map((m) => m.content)
        active = true
      }
      const shade = Math.round(Math.max(0, Math.min(1, dim)) * alpha * 100) / 100
      if (shade === lastShade) return
      lastShade = shade
      for (let i = 0; i < metas.length; i++) {
        const blended = blendThemeColor(originals[i]!, dim, alpha)
        if (blended !== undefined) {
          metas[i]!.content = blended
        }
      }
    },
    restore: () => {
      if (!active) return
      active = false
      lastShade = -1
      for (let i = 0; i < metas.length; i++) {
        metas[i]!.content = originals[i]!
      }
    }
  }
}
