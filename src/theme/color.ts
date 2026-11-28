export interface OklchColor {
  /** Perceptual lightness in `[0, 1]`. */
  readonly l: number
  /** Chroma (`>= 0`). */
  readonly c: number
  /** Hue angle in degrees `[0, 360)`. */
  readonly h: number
  /** Alpha opacity in `[0, 1]`. Defaults to `1`. */
  readonly alpha: number
}

export interface SrgbColor {
  /** Red channel in `[0, 1]`. */
  readonly r: number
  /** Green channel in `[0, 1]`. */
  readonly g: number
  /** Blue channel in `[0, 1]`. */
  readonly b: number
  /** Alpha opacity in `[0, 1]`. */
  readonly alpha: number
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))
const normalizeHue = (h: number): number => ((h % 360) + 360) % 360
const round = (v: number, digits = 4): number => {
  const f = 10 ** digits
  return Math.round(v * f) / f
}

export const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4

export const linearToSrgb = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055

/**
 * Converts OKLCH to unbounded linear sRGB using Björn Ottosson's exact OKLab
 * matrices so gamut checks can detect out-of-gamut channels cleanly.
 */
export const oklchToLinearSrgb = (
  color: OklchColor
): { readonly r: number; readonly g: number; readonly b: number } => {
  const rad = (color.h * Math.PI) / 180
  const a = color.c * Math.cos(rad)
  const b = color.c * Math.sin(rad)

  const l_ = color.l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = color.l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = color.l - 0.0894841775 * a - 1.291485548 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  }
}

export const isInSrgbGamut = (color: OklchColor, eps = 1e-4): boolean => {
  const { b, g, r } = oklchToLinearSrgb(color)
  return (
    r >= -eps &&
    r <= 1 + eps &&
    g >= -eps &&
    g <= 1 + eps &&
    b >= -eps &&
    b <= 1 + eps
  )
}

/**
 * Converts OKLCH to unbounded linear Display-P3.
 */
export const oklchToLinearP3 = (
  color: OklchColor
): { readonly r: number; readonly g: number; readonly b: number } => {
  const lin = oklchToLinearSrgb(color)
  return {
    r: 0.8224621 * lin.r + 0.177538 * lin.g,
    g: 0.0331941 * lin.r + 0.9668058 * lin.g,
    b: 0.0170827 * lin.r + 0.0723974 * lin.g + 0.9105199 * lin.b
  }
}

export const isInP3Gamut = (color: OklchColor, eps = 1e-4): boolean => {
  const { b, g, r } = oklchToLinearP3(color)
  return (
    r >= -eps &&
    r <= 1 + eps &&
    g >= -eps &&
    g <= 1 + eps &&
    b >= -eps &&
    b <= 1 + eps
  )
}

/**
 * Binary-search chroma gamut mapping preserving exact lightness `l` and hue
 * `h` so colors never experience hue drift when clamped to sRGB or Display-P3.
 */
export const clampToGamut = (
  color: OklchColor,
  gamut: "srgb" | "p3" = "srgb"
): OklchColor => {
  const l = clamp01(color.l)
  const h = normalizeHue(color.h)
  const alpha = clamp01(color.alpha)
  if (l <= 0 || l >= 1 || color.c <= 0) {
    return { l, c: 0, h, alpha }
  }
  const base: OklchColor = { l, c: Math.max(0, color.c), h, alpha }
  const check = gamut === "p3" ? isInP3Gamut : isInSrgbGamut
  if (check(base)) return base

  let lo = 0
  let hi = base.c
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (check({ l, c: mid, h, alpha })) lo = mid
    else hi = mid
  }
  return { l, c: Math.floor(lo * 1e5) / 1e5, h, alpha }
}

export const oklchToSrgb = (color: OklchColor): SrgbColor => {
  const mapped = clampToGamut(color, "srgb")
  const lin = oklchToLinearSrgb(mapped)
  return {
    r: clamp01(linearToSrgb(lin.r)),
    g: clamp01(linearToSrgb(lin.g)),
    b: clamp01(linearToSrgb(lin.b)),
    alpha: clamp01(color.alpha)
  }
}

export const srgbToOklch = (color: SrgbColor): OklchColor => {
  const r = srgbToLinear(clamp01(color.r))
  const g = srgbToLinear(clamp01(color.g))
  const b = srgbToLinear(clamp01(color.b))

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  const c = Math.hypot(A, B)
  const h = c < 1e-6 ? 0 : normalizeHue((Math.atan2(B, A) * 180) / Math.PI)
  return {
    l: round(clamp01(L), 5),
    c: round(c, 5),
    h: round(h, 2),
    alpha: clamp01(color.alpha)
  }
}

/**
 * Parses `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `oklch(...)`, or `rgb(...)`.
 */
export const parseColor = (input: string): OklchColor | undefined => {
  const s = input.trim().toLowerCase()
  if (s.startsWith("#")) {
    const hex = s.slice(1)
    if (hex.length === 3 || hex.length === 4) {
      const h0 = hex.charAt(0)
      const h1 = hex.charAt(1)
      const h2 = hex.charAt(2)
      const h3 = hex.charAt(3)
      const r = Number.parseInt(h0 + h0, 16)
      const g = Number.parseInt(h1 + h1, 16)
      const b = Number.parseInt(h2 + h2, 16)
      const a = hex.length === 4 ? Number.parseInt(h3 + h3, 16) : 255
      if ([r, g, b, a].some(Number.isNaN)) return undefined
      return srgbToOklch({ r: r / 255, g: g / 255, b: b / 255, alpha: a / 255 })
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16)
      const g = Number.parseInt(hex.slice(2, 4), 16)
      const b = Number.parseInt(hex.slice(4, 6), 16)
      const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255
      if ([r, g, b, a].some(Number.isNaN)) return undefined
      return srgbToOklch({ r: r / 255, g: g / 255, b: b / 255, alpha: a / 255 })
    }
    return undefined
  }

  const oklchMatch = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(s)
  if (oklchMatch !== null) {
    const [, rawL, rawC, rawH, rawA] = oklchMatch
    if (rawL === undefined || rawC === undefined || rawH === undefined) return undefined
    const l = rawL.endsWith("%") ? Number.parseFloat(rawL) / 100 : Number.parseFloat(rawL)
    const c = Number.parseFloat(rawC)
    const h = Number.parseFloat(rawH)
    const alpha =
      rawA === undefined
        ? 1
        : rawA.endsWith("%")
        ? Number.parseFloat(rawA) / 100
        : Number.parseFloat(rawA)
    if ([l, c, h, alpha].some(Number.isNaN)) return undefined
    return { l: clamp01(l), c: Math.max(0, c), h: normalizeHue(h), alpha: clamp01(alpha) }
  }

  const rgbMatch = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s)
  if (rgbMatch !== null) {
    const [, rawR, rawG, rawB, rawA] = rgbMatch
    if (rawR === undefined || rawG === undefined || rawB === undefined) return undefined
    const r = Number.parseFloat(rawR) / 255
    const g = Number.parseFloat(rawG) / 255
    const b = Number.parseFloat(rawB) / 255
    const alpha =
      rawA === undefined
        ? 1
        : rawA.endsWith("%")
        ? Number.parseFloat(rawA) / 100
        : Number.parseFloat(rawA)
    if ([r, g, b, alpha].some(Number.isNaN)) return undefined
    return srgbToOklch({ r: clamp01(r), g: clamp01(g), b: clamp01(b), alpha: clamp01(alpha) })
  }

  return undefined
}

export const formatOklch = (color: OklchColor): string => {
  const l = round(clamp01(color.l), 4)
  const c = round(Math.max(0, color.c), 4)
  const h = round(normalizeHue(color.h), 2)
  const a = round(clamp01(color.alpha), 4)
  return a < 1 ? `oklch(${l} ${c} ${h} / ${a})` : `oklch(${l} ${c} ${h})`
}

export const formatHex = (color: OklchColor): string => {
  const rgb = oklchToSrgb(color)
  const hex = (v: number) =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, "0")
  const base = `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`
  return rgb.alpha < 1 ? `${base}${hex(rgb.alpha)}` : base
}

/**
 * Perceptual OKLCH interpolation along the shorter hue arc.
 */
export const mixOklch = (
  a: OklchColor,
  b: OklchColor,
  t: number
): OklchColor => {
  const ratio = clamp01(t)
  let dh = b.h - a.h
  if (dh > 180) dh -= 360
  if (dh < -180) dh += 360
  const h =
    a.c < 1e-5
      ? b.h
      : b.c < 1e-5
      ? a.h
      : normalizeHue(a.h + dh * ratio)
  return {
    l: round(a.l + (b.l - a.l) * ratio, 4),
    c: round(a.c + (b.c - a.c) * ratio, 4),
    h: round(h, 2),
    alpha: round(a.alpha + (b.alpha - a.alpha) * ratio, 4)
  }
}

export const SCALE_STEPS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
] as const
export type ScaleStep = (typeof SCALE_STEPS)[number]

/**
 * Generates an 11-step perceptually uniform OKLCH ramp (`50..950`) clamped to
 * the chosen gamut while keeping hue constant.
 */
export const generateScale = (
  hue: number,
  peakChroma: number,
  gamut: "srgb" | "p3" = "srgb"
): Readonly<Record<ScaleStep, OklchColor>> => {
  const lightnessByStep: Readonly<Record<ScaleStep, number>> = {
    50: 0.975,
    100: 0.94,
    200: 0.87,
    300: 0.78,
    400: 0.68,
    500: 0.58,
    600: 0.49,
    700: 0.41,
    800: 0.33,
    900: 0.25,
    950: 0.17
  }
  const chromaWeight: Readonly<Record<ScaleStep, number>> = {
    50: 0.14,
    100: 0.28,
    200: 0.52,
    300: 0.78,
    400: 0.95,
    500: 1.0,
    600: 0.96,
    700: 0.84,
    800: 0.68,
    900: 0.5,
    950: 0.35
  }
  const stepColor = (step: ScaleStep): OklchColor =>
    clampToGamut(
      {
        l: lightnessByStep[step],
        c: peakChroma * chromaWeight[step],
        h: normalizeHue(hue),
        alpha: 1
      },
      gamut
    )
  return {
    50: stepColor(50),
    100: stepColor(100),
    200: stepColor(200),
    300: stepColor(300),
    400: stepColor(400),
    500: stepColor(500),
    600: stepColor(600),
    700: stepColor(700),
    800: stepColor(800),
    900: stepColor(900),
    950: stepColor(950)
  }
}
