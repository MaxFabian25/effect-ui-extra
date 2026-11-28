import type { ContrastPair } from "./contrast.js"

export interface ThemeTokens {
  readonly background: string
  readonly surface: string
  readonly muted: string
  readonly foreground: string
  readonly mutedForeground: string
  readonly border: string
  readonly inputBorder: string
  readonly primary: string
  readonly primaryForeground: string
  readonly accent: string
  readonly accentForeground: string
  readonly destructive: string
  readonly destructiveForeground: string
  readonly ring: string
}

export const TOKEN_CSS_NAMES: Readonly<Record<keyof ThemeTokens, string>> = {
  background: "--eui-bg",
  surface: "--eui-surface",
  muted: "--eui-muted",
  foreground: "--eui-fg",
  mutedForeground: "--eui-fg-muted",
  border: "--eui-border",
  inputBorder: "--eui-input-border",
  primary: "--eui-primary",
  primaryForeground: "--eui-primary-fg",
  accent: "--eui-accent",
  accentForeground: "--eui-accent-fg",
  destructive: "--eui-destructive",
  destructiveForeground: "--eui-destructive-fg",
  ring: "--eui-ring"
}

export const DEFAULT_LIGHT_TOKENS: ThemeTokens = {
  background: "oklch(0.99 0.002 260)",
  surface: "oklch(0.965 0.004 260)",
  muted: "oklch(0.935 0.006 260)",
  foreground: "oklch(0.18 0.014 260)",
  mutedForeground: "oklch(0.45 0.015 260)",
  border: "oklch(0.84 0.01 260)",
  inputBorder: "oklch(0.57 0.014 260)",
  primary: "oklch(0.46 0.16 260)",
  primaryForeground: "oklch(0.99 0.002 260)",
  accent: "oklch(0.92 0.035 260)",
  accentForeground: "oklch(0.24 0.08 260)",
  destructive: "oklch(0.5 0.19 27)",
  destructiveForeground: "oklch(0.99 0.002 27)",
  ring: "oklch(0.5 0.17 260)"
}

export const DEFAULT_DARK_TOKENS: ThemeTokens = {
  background: "oklch(0.16 0.01 260)",
  surface: "oklch(0.21 0.012 260)",
  muted: "oklch(0.25 0.012 260)",
  foreground: "oklch(0.95 0.006 260)",
  mutedForeground: "oklch(0.78 0.012 260)",
  border: "oklch(0.32 0.012 260)",
  inputBorder: "oklch(0.6 0.015 260)",
  primary: "oklch(0.74 0.12 258)",
  primaryForeground: "oklch(0.15 0.012 260)",
  accent: "oklch(0.29 0.04 258)",
  accentForeground: "oklch(0.93 0.02 258)",
  destructive: "oklch(0.78 0.12 25)",
  destructiveForeground: "oklch(0.14 0.012 25)",
  ring: "oklch(0.74 0.12 258)"
}

/**
 * Returns the full WCAG 2.1 AA contrast pair set for a semantic token theme:
 * `>= 4.5:1` for text surfaces and `>= 3.0:1` for interactive control borders
 * and focus rings.
 */
export const themeContrastPairs = (
  tokens: ThemeTokens
): ReadonlyArray<ContrastPair> => [
  {
    name: "foreground on background",
    fg: tokens.foreground,
    bg: tokens.background,
    minRatio: 4.5
  },
  {
    name: "foreground on surface",
    fg: tokens.foreground,
    bg: tokens.surface,
    minRatio: 4.5
  },
  {
    name: "foreground on muted",
    fg: tokens.foreground,
    bg: tokens.muted,
    minRatio: 4.5
  },
  {
    name: "mutedForeground on background",
    fg: tokens.mutedForeground,
    bg: tokens.background,
    minRatio: 4.5
  },
  {
    name: "mutedForeground on surface",
    fg: tokens.mutedForeground,
    bg: tokens.surface,
    minRatio: 4.5
  },
  {
    name: "mutedForeground on muted",
    fg: tokens.mutedForeground,
    bg: tokens.muted,
    minRatio: 4.5
  },
  {
    name: "primaryForeground on primary",
    fg: tokens.primaryForeground,
    bg: tokens.primary,
    minRatio: 4.5
  },
  {
    name: "primary on background",
    fg: tokens.primary,
    bg: tokens.background,
    minRatio: 4.5
  },
  {
    name: "primary on surface",
    fg: tokens.primary,
    bg: tokens.surface,
    minRatio: 4.5
  },
  {
    name: "accentForeground on accent",
    fg: tokens.accentForeground,
    bg: tokens.accent,
    minRatio: 4.5
  },
  {
    name: "destructiveForeground on destructive",
    fg: tokens.destructiveForeground,
    bg: tokens.destructive,
    minRatio: 4.5
  },
  {
    name: "destructive on background",
    fg: tokens.destructive,
    bg: tokens.background,
    minRatio: 4.5
  },
  {
    name: "destructive on surface",
    fg: tokens.destructive,
    bg: tokens.surface,
    minRatio: 4.5
  },
  {
    name: "inputBorder on background",
    fg: tokens.inputBorder,
    bg: tokens.background,
    minRatio: 3.0
  },
  {
    name: "inputBorder on surface",
    fg: tokens.inputBorder,
    bg: tokens.surface,
    minRatio: 3.0
  },
  {
    name: "ring on background",
    fg: tokens.ring,
    bg: tokens.background,
    minRatio: 3.0
  },
  {
    name: "ring on surface",
    fg: tokens.ring,
    bg: tokens.surface,
    minRatio: 3.0
  }
]

/**
 * Generates an `@layer effect-ui` CSS token block with concrete light/dark
 * fallbacks for browsers without `light-dark()` plus progressive enhancement
 * via `@supports (color: light-dark(white, black))` and `[data-color-scheme]`
 * overrides compatible with `effect-ui-page`.
 */
const THEME_TOKEN_KEYS: ReadonlyArray<keyof ThemeTokens> = [
  "background",
  "surface",
  "muted",
  "foreground",
  "mutedForeground",
  "border",
  "inputBorder",
  "primary",
  "primaryForeground",
  "accent",
  "accentForeground",
  "destructive",
  "destructiveForeground",
  "ring"
]

export const generateThemeCss = (
  light: ThemeTokens = DEFAULT_LIGHT_TOKENS,
  dark: ThemeTokens = DEFAULT_DARK_TOKENS,
  options: { readonly layer?: string } = {}
): string => {
  const layer = options.layer ?? "effect-ui"
  const keys = THEME_TOKEN_KEYS
  const lightDecls = keys
    .map((key) => `    ${TOKEN_CSS_NAMES[key]}: ${light[key]};`)
    .join("\n")
  const darkDecls = keys
    .map((key) => `    ${TOKEN_CSS_NAMES[key]}: ${dark[key]};`)
    .join("\n")
  const lightDarkDecls = keys
    .map(
      (key) =>
        `      ${TOKEN_CSS_NAMES[key]}: light-dark(${light[key]}, ${dark[key]});`
    )
    .join("\n")

  return `@layer ${layer} {
  :root {
    color-scheme: light dark;
  }

  :root[data-color-scheme="light"] { color-scheme: light; }
  :root[data-color-scheme="dark"] { color-scheme: dark; }

  @supports not (color: light-dark(white, black)) {
    :root {
${lightDecls}
    }

    @media (prefers-color-scheme: dark) {
      :root:not([data-color-scheme="light"]) {
${darkDecls}
      }
    }

    :root[data-color-scheme="light"] {
${lightDecls}
    }

    :root[data-color-scheme="dark"] {
${darkDecls}
    }
  }

  @supports (color: light-dark(white, black)) {
    :root {
${lightDarkDecls}
    }
  }
}
`
}
