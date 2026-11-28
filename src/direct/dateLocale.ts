/** Weekday index matching `Date#getDay()` (`0` = Sunday, `1` = Monday, ..., `6` = Saturday). */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface PlainDate {
  readonly year: number
  readonly month: number
  readonly day: number
}

const SUNDAY_REGIONS = new Set(
  "AG AS BD BR BS BT BW BZ CA CO DM DO ET GT GU HK HN ID IL IN IS JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW".split(" ")
)
const FRIDAY_REGIONS = new Set(["MV"])
const SATURDAY_REGIONS = new Set(
  "AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY".split(" ")
)

const FW_EXTENSION_MAP: Readonly<Record<string, WeekdayIndex>> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
}

/**
 * Pure CLDR-backed first day of the week for a BCP-47 locale tag, honoring
 * `-u-fw-` overrides (e.g. `en-US-u-fw-mon`) and deterministic across SSR and
 * every browser without relying on `Intl.Locale#getWeekInfo`.
 */
export const firstDayOfWeek = (locale: string): WeekdayIndex => {
  const lower = locale.trim().toLowerCase()
  const fwMatch = /-u-(?:[a-z0-9]+-)*fw-([a-z]{3})\b/.exec(lower)
  if (fwMatch !== null) {
    const override = FW_EXTENSION_MAP[fwMatch[1]!]
    if (override !== undefined) return override
  }

  const base = lower.split("-u-")[0] ?? lower
  const subtags = base.split("-")
  let region: string | undefined
  for (let i = 1; i < subtags.length; i++) {
    const tag = subtags[i]!
    if (/^[a-z]{2}$/.test(tag)) {
      region = tag.toUpperCase()
      break
    }
  }
  if (region === undefined) {
    // Common language-only defaults matching CLDR likelySubtags
    const lang = subtags[0]
    if (lang === "en" || lang === "ja" || lang === "ko" || lang === "he") region = "US"
    else if (lang === "ar") region = "EG"
  }
  if (region !== undefined) {
    if (SUNDAY_REGIONS.has(region)) return 0
    if (FRIDAY_REGIONS.has(region)) return 5
    if (SATURDAY_REGIONS.has(region)) return 6
  }
  return 1
}

const pad2 = (n: number): string => String(n).padStart(2, "0")
const pad4 = (n: number): string => String(n).padStart(4, "0")

export const isValidPlainDate = (d: PlainDate): boolean => {
  if (!Number.isInteger(d.year) || !Number.isInteger(d.month) || !Number.isInteger(d.day)) {
    return false
  }
  if (d.month < 1 || d.month > 12 || d.day < 1 || d.day > 31) return false
  const dt = new Date(Date.UTC(d.year, d.month - 1, d.day))
  return (
    dt.getUTCFullYear() === d.year &&
    dt.getUTCMonth() === d.month - 1 &&
    dt.getUTCDate() === d.day
  )
}

/** Parses an ISO `YYYY-MM-DD` string into a validated `PlainDate`. */
export const parsePlainDate = (raw: string): PlainDate | undefined => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim())
  if (m === null) return undefined
  const candidate: PlainDate = {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3])
  }
  return isValidPlainDate(candidate) ? candidate : undefined
}

export const formatPlainDate = (d: PlainDate): string =>
  `${pad4(d.year)}-${pad2(d.month)}-${pad2(d.day)}`

export const addDays = (d: PlainDate, deltaDays: number): PlainDate => {
  const dt = new Date(Date.UTC(d.year, d.month - 1, d.day + Math.trunc(deltaDays)))
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate()
  }
}

export const comparePlainDates = (a: PlainDate, b: PlainDate): -1 | 0 | 1 => {
  if (a.year !== b.year) return a.year < b.year ? -1 : 1
  if (a.month !== b.month) return a.month < b.month ? -1 : 1
  if (a.day !== b.day) return a.day < b.day ? -1 : 1
  return 0
}
