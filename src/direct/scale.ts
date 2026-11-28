export type NumberScale =
  | "linear"
  | "log"
  | {
      readonly to: (value: number) => number
      readonly from: (scaled: number) => number
    }

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

const toScaled = (value: number, scale: NumberScale): number => {
  if (scale === "linear") return value
  if (scale === "log") return Math.log(Math.max(1e-12, value))
  return scale.to(value)
}

const fromScaled = (scaled: number, scale: NumberScale): number => {
  if (scale === "linear") return scaled
  if (scale === "log") return Math.exp(scaled)
  return scale.from(scaled)
}

/** Maps a domain value within `[min, max]` to a normalized `[0, 1]` ratio along `scale`. */
export const valueToRatio = (
  value: number,
  min: number,
  max: number,
  scale: NumberScale = "linear"
): number => {
  if (max <= min) return 0
  const sMin = toScaled(min, scale)
  const sMax = toScaled(max, scale)
  const span = sMax - sMin
  if (span === 0 || !Number.isFinite(span)) return 0
  return clamp01((toScaled(value, scale) - sMin) / span)
}

/** Maps a normalized `[0, 1]` ratio back into `[min, max]` along `scale`. */
export const ratioToValue = (
  ratio: number,
  min: number,
  max: number,
  scale: NumberScale = "linear"
): number => {
  if (max <= min) return min
  const r = clamp01(ratio)
  const sMin = toScaled(min, scale)
  const sMax = toScaled(max, scale)
  const raw = fromScaled(sMin + (sMax - sMin) * r, scale)
  return Math.max(min, Math.min(max, raw))
}

/** Snaps `value` to the nearest step anchored at `min`, clamped to `[min, max]`. */
export const snapToStep = (
  value: number,
  min: number,
  max: number,
  step: number
): number => {
  if (max <= min) return min
  if (step <= 0 || !Number.isFinite(step)) return Math.max(min, Math.min(max, value))
  const clamped = Math.max(min, Math.min(max, value))
  const steps = Math.round((clamped - min) / step)
  const snapped = min + steps * step
  // Normalize IEEE 754 drift to match step decimal precision
  const stepStr = String(step)
  const decimals = stepStr.includes(".") ? stepStr.split(".")[1]!.length : 0
  const rounded = Number(snapped.toFixed(decimals))
  return Math.max(min, Math.min(max, rounded))
}

export const formatLocalizedNumber = (
  value: number,
  locale?: string,
  options?: Intl.NumberFormatOptions
): string => new Intl.NumberFormat(locale, options).format(value)

/**
 * Parses a localized formatted number string (supporting group separators,
 * comma decimals such as `"1.234,56"` in `da-DK`/`de-DE`, currency prefixes,
 * and percentage suffixes). Returns `undefined` if unparseable.
 */
export const parseLocalizedNumber = (
  raw: string,
  locale?: string
): number | undefined => {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return undefined
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6)
  const group = parts.find((p) => p.type === "group")?.value ?? ","
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? "."
  const isPercent = trimmed.includes("%")

  // Strip currency/whitespace/percent while keeping sign, digits, group, and decimal
  let cleaned = trimmed.replace(/\s+/g, "").replace(/\u00a0/g, "").replace(/%/g, "")
  if (group.length > 0 && group !== decimal) {
    cleaned = cleaned.split(group).join("")
  }
  if (decimal !== ".") {
    cleaned = cleaned.split(decimal).join(".")
  }
  // Remove leading/trailing non-numeric currency symbols (e.g. "kr.", "$", "€")
  cleaned = cleaned.replace(/^[^0-9+\-.]+/, "").replace(/[^0-9]+$/, "")
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(cleaned)) return undefined
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return undefined
  return isPercent ? n / 100 : n
}
