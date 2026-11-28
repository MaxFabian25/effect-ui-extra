import { oklchToSrgb, parseColor, srgbToLinear } from './color.js';
import type { OklchColor } from './color.js';

const resolve = (input: OklchColor | string): OklchColor => {
  if (typeof input !== "string") return input
  const parsed = parseColor(input)
  if (parsed === undefined) {
    throw new Error(`Invalid color string: "${input}"`)
  }
  return parsed
}

/**
 * WCAG 2.1 relative luminance in `[0, 1]`.
 */
export const relativeLuminance = (input: OklchColor | string): number => {
  const rgb = oklchToSrgb(resolve(input))
  const r = srgbToLinear(rgb.r)
  const g = srgbToLinear(rgb.g)
  const b = srgbToLinear(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Composites a semi-transparent foreground color over an opaque background.
 */
export const compositeOver = (
  fg: OklchColor | string,
  bg: OklchColor | string
): { readonly r: number; readonly g: number; readonly b: number } => {
  const f = oklchToSrgb(resolve(fg))
  const b = oklchToSrgb(resolve(bg))
  const a = f.alpha
  return {
    r: f.r * a + b.r * (1 - a),
    g: f.g * a + b.g * (1 - a),
    b: f.b * a + b.b * (1 - a)
  }
}

const rawWcagContrast = (
  fg: OklchColor | string,
  bg: OklchColor | string
): number => {
  const cFg = compositeOver(fg, bg)
  const cBg = oklchToSrgb(resolve(bg))
  const l1 =
    0.2126 * srgbToLinear(cFg.r) +
    0.7152 * srgbToLinear(cFg.g) +
    0.0722 * srgbToLinear(cFg.b)
  const l2 =
    0.2126 * srgbToLinear(cBg.r) +
    0.7152 * srgbToLinear(cBg.g) +
    0.0722 * srgbToLinear(cBg.b)
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * WCAG 2.1 contrast ratio in `[1, 21]`, compositing alpha foregrounds over `bg`.
 */
export const wcagContrast = (
  fg: OklchColor | string,
  bg: OklchColor | string
): number => Math.round(rawWcagContrast(fg, bg) * 100) / 100

export const meetsWcagAA = (
  fg: OklchColor | string,
  bg: OklchColor | string,
  largeText = false
): boolean => rawWcagContrast(fg, bg) >= (largeText ? 3.0 : 4.5)

export const meetsWcagAAA = (
  fg: OklchColor | string,
  bg: OklchColor | string,
  largeText = false
): boolean => rawWcagContrast(fg, bg) >= (largeText ? 4.5 : 7.0)

export const meetsUiControlContrast = (
  control: OklchColor | string,
  bg: OklchColor | string
): boolean => rawWcagContrast(control, bg) >= 3.0

/**
 * APCA W3 0.0.98G-4g perceptual lightness contrast (`Lc`), signed:
 * positive = dark text on light background, negative = light text on dark background.
 */
export const apcaContrast = (
  text: OklchColor | string,
  bg: OklchColor | string
): number => {
  const t = compositeOver(text, bg)
  const b = oklchToSrgb(resolve(bg))

  const yOf = (rgb: { readonly r: number; readonly g: number; readonly b: number }) =>
    0.2126729 * Math.pow(rgb.r, 2.4) +
    0.7151522 * Math.pow(rgb.g, 2.4) +
    0.072175 * Math.pow(rgb.b, 2.4)

  const softClamp = (y: number) =>
    y > 0.022 ? y : y + Math.pow(0.022 - y, 1.414)

  const txtY = softClamp(yOf(t))
  const bgY = softClamp(yOf(b))

  if (Math.abs(bgY - txtY) < 0.0005) return 0

  if (bgY > txtY) {
    const sapc = (Math.pow(bgY, 0.56) - Math.pow(txtY, 0.57)) * 1.14
    const out = sapc < 0.1 ? 0 : (sapc - 0.027) * 100
    return Math.round(out * 10) / 10
  }
  const sapc = (Math.pow(bgY, 0.65) - Math.pow(txtY, 0.62)) * 1.14
  const out = sapc > -0.1 ? 0 : (sapc + 0.027) * 100
  return Math.round(out * 10) / 10
}

export interface ContrastPair {
  readonly name: string
  readonly fg: string
  readonly bg: string
  readonly minRatio: number
}

export interface ContrastFailure {
  readonly name: string
  readonly fg: string
  readonly bg: string
  readonly ratio: number
  readonly minRatio: number
}

/**
 * Audits a list of semantic color token pairs and returns every pair that
 * falls below its minimum WCAG 2.1 contrast ratio.
 */
export const auditThemeContrast = (
  pairs: ReadonlyArray<ContrastPair>
): ReadonlyArray<ContrastFailure> => {
  const failures: Array<ContrastFailure> = []
  for (const pair of pairs) {
    const raw = rawWcagContrast(pair.fg, pair.bg)
    if (raw < pair.minRatio) {
      failures.push({
        name: pair.name,
        fg: pair.fg,
        bg: pair.bg,
        ratio: Math.round(raw * 100) / 100,
        minRatio: pair.minRatio
      })
    }
  }
  return failures
}
