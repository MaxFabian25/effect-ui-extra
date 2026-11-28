import type { Html } from "@effect/ui/html"
import * as Match from "effect/Match"

/**
 * Resolves effective reading direction: explicit `dir` prop wins, otherwise
 * inherits `<html dir="rtl">` in browser runtimes and defaults to `"ltr"` in SSR.
 */
export const resolveDir = (explicit?: "ltr" | "rtl"): "ltr" | "rtl" => {
  if (explicit !== undefined) return explicit
  if (
    typeof document !== "undefined" &&
    document.documentElement?.dir?.toLowerCase() === "rtl"
  ) {
    return "rtl"
  }
  return "ltr"
}

/**
 * Encodes an arbitrary item value into a valid HTML ID token with no whitespace.
 */
export const safeIdToken = (raw: string): string =>
  encodeURIComponent(raw).replace(/%/g, "_")

export const chevronRightIcon = <Msg>(h: Html.H<Msg>) =>
  h.svg
    .attrs({
      width: "16",
      height: "16",
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      "data-tree-chevron": ""
    })
    .children(h.path.attrs({ d: "M6 3.5L10.5 8L6 12.5" }))

export const closeIcon = <Msg>(h: Html.H<Msg>) =>
  h.svg
    .attrs({
      width: "16",
      height: "16",
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linecap": "round",
      "aria-hidden": "true"
    })
    .children(
      h.path.attrs({ d: "M4.5 4.5L11.5 11.5M11.5 4.5L4.5 11.5" })
    )

const STAR_PATH =
  "M8 1.5L9.95 5.45L14.3 6.08L11.15 9.15L11.9 13.5L8 11.45L4.1 13.5L4.85 9.15L1.7 6.08L6.05 5.45L8 1.5Z"

export const starIcon = <Msg>(
  h: Html.H<Msg>,
  filled: boolean,
  half?: "start" | "end"
) => {
  const viewBox = Match.value(half).pipe(
    Match.when("start", () => "0 0 8 16"),
    Match.when("end", () => "8 0 8 16"),
    Match.orElse(() => "0 0 16 16")
  )
  const width = half !== undefined ? "8" : "16"
  return h.svg
    .attrs({
      width,
      height: "16",
      viewBox,
      fill: filled ? "currentColor" : "none",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linejoin": "round",
      "aria-hidden": "true"
    })
    .children(h.path.attrs({ d: STAR_PATH }))
}
