export interface FuzzyRange {
  readonly start: number
  readonly end: number
}

export interface FuzzyMatch {
  /** Normalized relevance score in `(0, 1]` where `1` is an exact match. */
  readonly score: number
  /** Merged `[start, end)` character spans in the original text for highlighting. */
  readonly ranges: ReadonlyArray<FuzzyRange>
}

interface NormalizedMap {
  readonly text: string
  /** Maps each normalized character index back to its original UTF-16 span `[start, end)`. */
  readonly spanMap: ReadonlyArray<FuzzyRange>
}

const COMBINING_RE = /[\u0300-\u036f]/g
const COMBINING_CHAR_RE = /^\p{M}$/u

const normalizeWithMap = (input: string): NormalizedMap => {
  let text = ""
  const spanMap: Array<FuzzyRange> = []
  let i = 0
  while (i < input.length) {
    const start = i
    i += 1
    while (i < input.length && COMBINING_CHAR_RE.test(input.charAt(i))) {
      i += 1
    }
    const cluster = input.slice(start, i)
    const stripped = cluster.normalize("NFD").replace(COMBINING_RE, "").toLowerCase()
    for (let j = 0; j < stripped.length; j++) {
      text += stripped[j]
      spanMap.push({ start, end: i })
    }
  }
  return { text, spanMap }
}

/**
 * Lowercases and strips accents for accent-insensitive search matching.
 */
export const normalizeText = (input: string): string =>
  input.normalize("NFD").replace(COMBINING_RE, "").toLowerCase()

const isWordBoundary = (text: string, index: number): boolean => {
  if (index <= 0) return true
  const prev = text.charAt(index - 1)
  return /[\s\-_/.:]/.test(prev)
}

const mergeSpans = (
  spans: ReadonlyArray<FuzzyRange>
): ReadonlyArray<FuzzyRange> => {
  const first = spans[0]
  if (first === undefined) return []
  const ranges: Array<FuzzyRange> = []
  let start = first.start
  let end = first.end
  for (let i = 1; i < spans.length; i++) {
    const s = spans[i]
    if (s === undefined) continue
    if (s.start <= end) {
      end = Math.max(end, s.end)
    } else {
      ranges.push({ start, end })
      start = s.start
      end = s.end
    }
  }
  ranges.push({ start, end })
  return ranges
}

const coverageBonus = (needleLen: number, haystackLen: number): number =>
  haystackLen === 0 ? 0 : (0.09 * needleLen) / haystackLen

/**
 * Accent-insensitive fuzzy scorer returning both a `0..1` score and highlight
 * character ranges in the original text, or `undefined` when there is no match.
 *
 * Ranking order: exact match > prefix > word-start substring > substring >
 * ordered subsequence (with word-start and consecutive-run bonuses).
 */
export const fuzzyMatch = (
  query: string,
  candidate: string
): FuzzyMatch | undefined => {
  const needle = normalizeText(query).trim()
  if (needle.length === 0) {
    return { score: 1, ranges: [] }
  }
  const { spanMap, text: haystack } = normalizeWithMap(candidate)
  if (haystack.length === 0) return undefined

  // 1. Exact match
  if (haystack === needle) {
    return {
      score: 1,
      ranges: [{ start: 0, end: candidate.length }]
    }
  }

  // 2. Prefix match
  if (haystack.startsWith(needle)) {
    const origSpans = spanMap.slice(0, needle.length)
    return {
      score: Math.min(0.99, 0.9 + coverageBonus(needle.length, haystack.length)),
      ranges: mergeSpans(origSpans)
    }
  }

  // 3. Word-start substring match
  for (
    let idx = haystack.indexOf(needle);
    idx !== -1;
    idx = haystack.indexOf(needle, idx + 1)
  ) {
    if (isWordBoundary(haystack, idx)) {
      const origSpans = spanMap.slice(idx, idx + needle.length)
      return {
        score: Math.min(0.89, 0.8 + coverageBonus(needle.length, haystack.length)),
        ranges: mergeSpans(origSpans)
      }
    }
  }

  // 4. Any contiguous substring match
  const subIdx = haystack.indexOf(needle)
  if (subIdx !== -1) {
    const origSpans = spanMap.slice(subIdx, subIdx + needle.length)
    return {
      score: Math.min(0.79, 0.7 + coverageBonus(needle.length, haystack.length)),
      ranges: mergeSpans(origSpans)
    }
  }

  // 5. Ordered subsequence match (spaces separate tokens)
  let pos = 0
  let prev = -2
  let bonus = 0
  const matchedNorm: Array<number> = []
  for (const ch of needle) {
    if (ch === " ") continue
    // Prefer a word-start match when available from pos
    let found = -1
    for (let i = haystack.indexOf(ch, pos); i !== -1; i = haystack.indexOf(ch, i + 1)) {
      if (found === -1) found = i
      if (isWordBoundary(haystack, i) || i === prev + 1) {
        found = i
        break
      }
    }
    if (found === -1) return undefined
    matchedNorm.push(found)
    if (isWordBoundary(haystack, found)) bonus += 1
    if (found === prev + 1) bonus += 1
    prev = found
    pos = found + 1
  }

  if (matchedNorm.length === 0) return undefined
  const maxBonus = matchedNorm.length * 2
  const quality = bonus / maxBonus
  const score = Math.min(
    0.69,
    0.25 + quality * 0.35 + coverageBonus(matchedNorm.length, haystack.length)
  )
  return {
    score,
    ranges: mergeSpans(
      matchedNorm.flatMap((i) => {
        const span = spanMap[i]
        return span !== undefined ? [span] : []
      })
    )
  }
}

export interface FuzzyFiltered<A> {
  readonly item: A
  readonly match: FuzzyMatch
}

/**
 * Filters and stably ranks `items` against `query` using primary text plus
 * optional keywords (keywords participate in scoring without polluting primary
 * text highlight ranges).
 */
export const fuzzyFilter = <A>(
  items: ReadonlyArray<A>,
  query: string,
  getText: (item: A) => string,
  getKeywords?: (item: A) => ReadonlyArray<string> | undefined
): ReadonlyArray<FuzzyFiltered<A>> => {
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return items.map((item) => ({ item, match: { score: 1, ranges: [] } }))
  }
  const scored: Array<{ readonly item: A; readonly match: FuzzyMatch; readonly index: number }> = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item === undefined) continue
    const primary = fuzzyMatch(trimmed, getText(item))
    let best = primary
    const keywords = getKeywords?.(item)
    if (keywords !== undefined) {
      for (const kw of keywords) {
        const kwMatch = fuzzyMatch(trimmed, kw)
        if (
          kwMatch !== undefined &&
          (best === undefined || kwMatch.score * 0.85 > best.score)
        ) {
          best = {
            score: kwMatch.score * 0.85,
            ranges: primary?.ranges ?? []
          }
        }
      }
    }
    if (best !== undefined) {
      scored.push({ item, match: best, index: i })
    }
  }
  scored.sort((a, b) =>
    b.match.score !== a.match.score
      ? b.match.score - a.match.score
      : a.index - b.index
  )
  return scored.map(({ item, match }) => ({ item, match }))
}
