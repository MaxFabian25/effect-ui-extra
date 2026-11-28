import type { IconPack } from "./schema.js"

export type UiIconName =
  | "chevronDown"
  | "chevronRight"
  | "check"
  | "close"
  | "search"
  | "copy"
  | "menu"

const INLINE_SVG_PATHS: Readonly<Record<UiIconName, string>> = {
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  check: "M20 6L9 17l-5-5",
  close: "M18 6L6 18M6 6l12 12",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.35-4.35",
  copy: "M8 8h12v12H8zM4 16V4h12",
  menu: "M4 6h16M4 12h16M4 18h16"
}

const ICON_PACK_LABELS: Readonly<Record<IconPack, string>> = {
  "inline-svg": "Zero-dependency inline SVG icons",
  lucide: "Lucide-compatible icon names (lucide)",
  tabler: "Tabler-compatible icon names (tabler)"
}

/**
 * Generates an owned `icons.ts` module tailored to the project's chosen
 * `iconPack` (`inline-svg`, `lucide`, or `tabler`) so styled blueprints render
 * crisp vector icons without forcing a runtime React icon dependency.
 */
export const generateIconModule = (iconPack: IconPack): string => {
  const pathEntries = Object.entries(INLINE_SVG_PATHS)
    .map(([k, d]) => `  ${k}: "${d}"`)
    .join(",\n")

  const packTokenMap: Readonly<Record<IconPack, Readonly<Record<UiIconName, string>>>> = {
    "inline-svg": {
      chevronDown: "chevron-down",
      chevronRight: "chevron-right",
      check: "check",
      close: "x",
      search: "search",
      copy: "copy",
      menu: "menu"
    },
    lucide: {
      chevronDown: "lucide:chevron-down",
      chevronRight: "lucide:chevron-right",
      check: "lucide:check",
      close: "lucide:x",
      search: "lucide:search",
      copy: "lucide:copy",
      menu: "lucide:menu"
    },
    tabler: {
      chevronDown: "tabler:chevron-down",
      chevronRight: "tabler:chevron-right",
      check: "tabler:check",
      close: "tabler:x",
      search: "tabler:search",
      copy: "tabler:copy",
      menu: "tabler:menu"
    }
  }

  const tokenEntries = Object.entries(packTokenMap[iconPack])
    .map(([k, v]) => `  ${k}: "${v}"`)
    .join(",\n")

  return `// Icon pack: ${iconPack} (${ICON_PACK_LABELS[iconPack]})
import type { Html } from "@effect/ui/html"

export type UiIconName =
  | "chevronDown"
  | "chevronRight"
  | "check"
  | "close"
  | "search"
  | "copy"
  | "menu"

export const ICON_PACK = "${iconPack}" as const

export const ICON_TOKENS: Readonly<Record<UiIconName, string>> = {
${tokenEntries}
}

const ICON_PATHS: Readonly<Record<UiIconName, string>> = {
${pathEntries}
}

/** Renders an accessible decorative icon with stable \`data-icon\` pack metadata. */
export const uiIcon = <Msg>(
  h: Html.H<Msg>,
  name: UiIconName,
  size = 16
) =>
  h.svg
    .attrs({
      width: String(size),
      height: String(size),
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      "data-icon": ICON_TOKENS[name]
    })
    .children(h.path.attrs({ d: ICON_PATHS[name] }))
`
}
