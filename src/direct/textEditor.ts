export interface TextEditResult {
  readonly value: string
  readonly selectionStart: number
  readonly selectionEnd: number
}

const clampOffset = (text: string, offset: number): number =>
  Math.max(0, Math.min(text.length, Math.floor(offset)))

/**
 * Replaces `[start, end)` in `text` with `replacement` and places the caret
 * cleanly at the end of the inserted text.
 */
export const replaceTextRange = (
  text: string,
  start: number,
  end: number,
  replacement: string
): TextEditResult => {
  const s = clampOffset(text, Math.min(start, end))
  const e = clampOffset(text, Math.max(start, end))
  const value = `${text.slice(0, s)}${replacement}${text.slice(e)}`
  const caret = s + replacement.length
  return { value, selectionStart: caret, selectionEnd: caret }
}

/**
 * Wraps the active selection `[start, end)` with `before` and `after` (which
 * defaults to `before`), keeping the inner text selected.
 */
export const wrapSelection = (
  text: string,
  start: number,
  end: number,
  before: string,
  after: string = before
): TextEditResult => {
  const s = clampOffset(text, Math.min(start, end))
  const e = clampOffset(text, Math.max(start, end))
  const inner = text.slice(s, e)
  const value = `${text.slice(0, s)}${before}${inner}${after}${text.slice(e)}`
  return {
    value,
    selectionStart: s + before.length,
    selectionEnd: s + before.length + inner.length
  }
}

const isWordChar = (ch: string): boolean => /[\p{L}\p{N}_]/u.test(ch)

/**
 * Finds the nearest previous or next word boundary from `offset` across
 * Unicode letters, digits, whitespace, and punctuation.
 */
export const findWordBoundary = (
  text: string,
  offset: number,
  direction: "backward" | "forward"
): number => {
  let i = clampOffset(text, offset)
  if (direction === "backward") {
    while (i > 0 && !isWordChar(text.charAt(i - 1))) i--
    while (i > 0 && isWordChar(text.charAt(i - 1))) i--
    return i
  }
  while (i < text.length && !isWordChar(text.charAt(i))) i++
  while (i < text.length && isWordChar(text.charAt(i))) i++
  return i
}

/**
 * Toggles a line `prefix` (such as `"- "` or `"> "`) across every line touched
 * by `[start, end)`, preserving selection bounds.
 */
export const toggleLinePrefix = (
  text: string,
  start: number,
  end: number,
  prefix: string
): TextEditResult => {
  const s = clampOffset(text, Math.min(start, end))
  const e = clampOffset(text, Math.max(start, end))
  const blockStart = text.lastIndexOf("\n", Math.max(0, s - 1)) + 1
  const nextNl = text.indexOf("\n", e)
  const blockEnd = nextNl === -1 ? text.length : nextNl

  const lines = text.slice(blockStart, blockEnd).split("\n")
  const allPrefixed = lines.every((l) => l.startsWith(prefix))
  const updated = lines.map((l) =>
    allPrefixed ? l.slice(prefix.length) : `${prefix}${l}`
  )
  const replaced = updated.join("\n")
  const value = `${text.slice(0, blockStart)}${replaced}${text.slice(blockEnd)}`
  const firstDelta = allPrefixed ? -prefix.length : prefix.length
  const totalDelta = replaced.length - (blockEnd - blockStart)

  return {
    value,
    selectionStart: Math.max(blockStart, s + firstDelta),
    selectionEnd: Math.max(blockStart, e + totalDelta)
  }
}
