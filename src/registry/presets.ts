import {
  DEFAULT_DARK_TOKENS,
  DEFAULT_LIGHT_TOKENS,
  generateThemeCss,
  type ThemeTokens
} from "../theme/tokens.js"
import type { PresetName } from "./schema.js"

export interface VisualPreset {
  readonly name: PresetName
  readonly title: string
  readonly description: string
  readonly radiusSm: string
  readonly radiusMd: string
  readonly radiusLg: string
  readonly density: "compact" | "comfortable" | "spacious"
  readonly fontSans: string
  readonly fontMono: string
  readonly light: ThemeTokens
  readonly dark: ThemeTokens
  readonly chartLight: readonly [string, string, string, string, string, string]
  readonly chartDark: readonly [string, string, string, string, string, string]
}

const SANS_DEFAULT =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const MONO_DEFAULT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

const CHART_LIGHT_DEFAULT: readonly [string, string, string, string, string, string] = [
  "oklch(0.5 0.17 258)",
  "oklch(0.55 0.14 170)",
  "oklch(0.6 0.16 65)",
  "oklch(0.54 0.17 305)",
  "oklch(0.56 0.18 22)",
  "oklch(0.52 0.12 220)"
]

const CHART_DARK_DEFAULT: readonly [string, string, string, string, string, string] = [
  "oklch(0.72 0.14 258)",
  "oklch(0.74 0.13 170)",
  "oklch(0.78 0.15 72)",
  "oklch(0.73 0.15 305)",
  "oklch(0.72 0.16 25)",
  "oklch(0.74 0.11 215)"
]

/**
 * Five WCAG 2.1 AA audited OKLCH visual presets for Effect UI + Tailwind v4
 * (paralleling shadcn's Vega, Nova, Maia, Lyra, and Mira styles).
 */
export const VISUAL_PRESETS: Readonly<Record<PresetName, VisualPreset>> = {
  nova: {
    name: "nova",
    title: "Nova",
    description: "Modern cobalt-indigo default with balanced radii and crisp elevation.",
    radiusSm: "0.375rem",
    radiusMd: "0.5rem",
    radiusLg: "0.75rem",
    density: "comfortable",
    fontSans: SANS_DEFAULT,
    fontMono: MONO_DEFAULT,
    light: DEFAULT_LIGHT_TOKENS,
    dark: DEFAULT_DARK_TOKENS,
    chartLight: CHART_LIGHT_DEFAULT,
    chartDark: CHART_DARK_DEFAULT
  },
  vega: {
    name: "vega",
    title: "Vega",
    description: "Neutral zinc-slate system with high-contrast charcoal actions.",
    radiusSm: "0.375rem",
    radiusMd: "0.5rem",
    radiusLg: "0.75rem",
    density: "comfortable",
    fontSans: SANS_DEFAULT,
    fontMono: MONO_DEFAULT,
    light: {
      background: "oklch(0.99 0 0)",
      surface: "oklch(0.965 0.002 250)",
      muted: "oklch(0.935 0.004 250)",
      foreground: "oklch(0.16 0.005 250)",
      mutedForeground: "oklch(0.44 0.008 250)",
      border: "oklch(0.85 0.004 250)",
      inputBorder: "oklch(0.56 0.008 250)",
      primary: "oklch(0.22 0.008 250)",
      primaryForeground: "oklch(0.985 0 0)",
      accent: "oklch(0.92 0.006 250)",
      accentForeground: "oklch(0.2 0.008 250)",
      destructive: "oklch(0.5 0.19 27)",
      destructiveForeground: "oklch(0.99 0.002 27)",
      ring: "oklch(0.45 0.012 250)"
    },
    dark: {
      background: "oklch(0.145 0.004 250)",
      surface: "oklch(0.195 0.006 250)",
      muted: "oklch(0.245 0.006 250)",
      foreground: "oklch(0.96 0.003 250)",
      mutedForeground: "oklch(0.75 0.008 250)",
      border: "oklch(0.31 0.006 250)",
      inputBorder: "oklch(0.6 0.008 250)",
      primary: "oklch(0.93 0.004 250)",
      primaryForeground: "oklch(0.16 0.006 250)",
      accent: "oklch(0.28 0.008 250)",
      accentForeground: "oklch(0.95 0.004 250)",
      destructive: "oklch(0.7 0.16 25)",
      destructiveForeground: "oklch(0.15 0.01 25)",
      ring: "oklch(0.74 0.01 250)"
    },
    chartLight: CHART_LIGHT_DEFAULT,
    chartDark: CHART_DARK_DEFAULT
  },
  maia: {
    name: "maia",
    title: "Maia",
    description: "Warm editorial stone palette with generous rounded corners.",
    radiusSm: "0.5rem",
    radiusMd: "0.75rem",
    radiusLg: "1rem",
    density: "spacious",
    fontSans: SANS_DEFAULT,
    fontMono: MONO_DEFAULT,
    light: {
      background: "oklch(0.985 0.006 75)",
      surface: "oklch(0.958 0.01 75)",
      muted: "oklch(0.925 0.012 75)",
      foreground: "oklch(0.2 0.016 55)",
      mutedForeground: "oklch(0.45 0.018 55)",
      border: "oklch(0.84 0.015 70)",
      inputBorder: "oklch(0.56 0.02 60)",
      primary: "oklch(0.46 0.14 38)",
      primaryForeground: "oklch(0.99 0.004 75)",
      accent: "oklch(0.91 0.03 65)",
      accentForeground: "oklch(0.25 0.05 45)",
      destructive: "oklch(0.49 0.19 25)",
      destructiveForeground: "oklch(0.99 0.002 25)",
      ring: "oklch(0.5 0.14 38)"
    },
    dark: {
      background: "oklch(0.16 0.009 55)",
      surface: "oklch(0.21 0.011 55)",
      muted: "oklch(0.255 0.012 55)",
      foreground: "oklch(0.95 0.008 75)",
      mutedForeground: "oklch(0.75 0.014 70)",
      border: "oklch(0.33 0.014 55)",
      inputBorder: "oklch(0.61 0.018 60)",
      primary: "oklch(0.74 0.13 42)",
      primaryForeground: "oklch(0.16 0.012 45)",
      accent: "oklch(0.29 0.03 50)",
      accentForeground: "oklch(0.94 0.015 70)",
      destructive: "oklch(0.7 0.16 25)",
      destructiveForeground: "oklch(0.16 0.012 25)",
      ring: "oklch(0.74 0.13 42)"
    },
    chartLight: [
      "oklch(0.5 0.15 38)",
      "oklch(0.52 0.12 155)",
      "oklch(0.55 0.14 80)",
      "oklch(0.48 0.13 245)",
      "oklch(0.54 0.16 15)",
      "oklch(0.5 0.1 200)"
    ],
    chartDark: CHART_DARK_DEFAULT
  },
  lyra: {
    name: "lyra",
    title: "Lyra",
    description: "Sharp architectural monochrome with tight corners and stark ink contrast.",
    radiusSm: "0.125rem",
    radiusMd: "0.25rem",
    radiusLg: "0.375rem",
    density: "comfortable",
    fontSans: SANS_DEFAULT,
    fontMono: MONO_DEFAULT,
    light: {
      background: "oklch(1 0 0)",
      surface: "oklch(0.97 0 0)",
      muted: "oklch(0.93 0 0)",
      foreground: "oklch(0.12 0 0)",
      mutedForeground: "oklch(0.42 0 0)",
      border: "oklch(0.8 0 0)",
      inputBorder: "oklch(0.52 0 0)",
      primary: "oklch(0.15 0 0)",
      primaryForeground: "oklch(0.99 0 0)",
      accent: "oklch(0.91 0 0)",
      accentForeground: "oklch(0.15 0 0)",
      destructive: "oklch(0.48 0.2 26)",
      destructiveForeground: "oklch(0.99 0 0)",
      ring: "oklch(0.28 0 0)"
    },
    dark: {
      background: "oklch(0.11 0 0)",
      surface: "oklch(0.16 0 0)",
      muted: "oklch(0.22 0 0)",
      foreground: "oklch(0.97 0 0)",
      mutedForeground: "oklch(0.75 0 0)",
      border: "oklch(0.32 0 0)",
      inputBorder: "oklch(0.6 0 0)",
      primary: "oklch(0.96 0 0)",
      primaryForeground: "oklch(0.12 0 0)",
      accent: "oklch(0.26 0 0)",
      accentForeground: "oklch(0.96 0 0)",
      destructive: "oklch(0.71 0.17 25)",
      destructiveForeground: "oklch(0.12 0 0)",
      ring: "oklch(0.82 0 0)"
    },
    chartLight: CHART_LIGHT_DEFAULT,
    chartDark: CHART_DARK_DEFAULT
  },
  mira: {
    name: "mira",
    title: "Mira",
    description: "Compact enterprise cool-slate palette designed for dense tables and ERP tools.",
    radiusSm: "0.25rem",
    radiusMd: "0.375rem",
    radiusLg: "0.5rem",
    density: "compact",
    fontSans: SANS_DEFAULT,
    fontMono: MONO_DEFAULT,
    light: {
      background: "oklch(0.99 0.003 240)",
      surface: "oklch(0.96 0.006 240)",
      muted: "oklch(0.93 0.008 240)",
      foreground: "oklch(0.19 0.018 245)",
      mutedForeground: "oklch(0.45 0.018 245)",
      border: "oklch(0.84 0.012 240)",
      inputBorder: "oklch(0.56 0.018 245)",
      primary: "oklch(0.44 0.14 235)",
      primaryForeground: "oklch(0.99 0.002 240)",
      accent: "oklch(0.91 0.03 235)",
      accentForeground: "oklch(0.23 0.07 235)",
      destructive: "oklch(0.5 0.19 27)",
      destructiveForeground: "oklch(0.99 0.002 27)",
      ring: "oklch(0.48 0.15 235)"
    },
    dark: {
      background: "oklch(0.155 0.012 245)",
      surface: "oklch(0.205 0.014 245)",
      muted: "oklch(0.25 0.015 245)",
      foreground: "oklch(0.95 0.006 240)",
      mutedForeground: "oklch(0.75 0.012 240)",
      border: "oklch(0.32 0.014 245)",
      inputBorder: "oklch(0.6 0.016 245)",
      primary: "oklch(0.73 0.12 232)",
      primaryForeground: "oklch(0.15 0.014 245)",
      accent: "oklch(0.28 0.035 235)",
      accentForeground: "oklch(0.93 0.02 235)",
      destructive: "oklch(0.7 0.16 25)",
      destructiveForeground: "oklch(0.15 0.012 25)",
      ring: "oklch(0.73 0.12 232)"
    },
    chartLight: CHART_LIGHT_DEFAULT,
    chartDark: CHART_DARK_DEFAULT
  }
}

export const getVisualPreset = (name: PresetName): VisualPreset => VISUAL_PRESETS[name]

export const listVisualPresets = (): ReadonlyArray<VisualPreset> =>
  Object.values(VISUAL_PRESETS)

/**
 * Generates a Tailwind v4 `@theme inline` + `@layer effect-ui` stylesheet for
 * the selected visual preset with full light/dark fallbacks and chart tokens.
 */
export const generatePresetCss = (name: PresetName): string => {
  const preset = VISUAL_PRESETS[name]
  const baseCss = generateThemeCss(preset.light, preset.dark)
  const chartLightDecls = preset.chartLight
    .map((c, i) => `    --eui-chart-${i + 1}: ${c};`)
    .join("\n")
  const chartDarkDecls = preset.chartDark
    .map((c, i) => `    --eui-chart-${i + 1}: ${c};`)
    .join("\n")

  return `/* effect-ui preset: ${preset.name} (${preset.title}) — ${preset.description} */
${baseCss}
@layer effect-ui {
  :root {
    --eui-radius-sm: ${preset.radiusSm};
    --eui-radius-md: ${preset.radiusMd};
    --eui-radius-lg: ${preset.radiusLg};
    --eui-font-sans: ${preset.fontSans};
    --eui-font-mono: ${preset.fontMono};
${chartLightDecls}
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-color-scheme="light"]) {
${chartDarkDecls}
    }
  }

  :root[data-color-scheme="dark"] {
${chartDarkDecls}
  }
}

@theme inline {
  --color-background: var(--eui-bg);
  --color-surface: var(--eui-surface);
  --color-muted: var(--eui-muted);
  --color-foreground: var(--eui-fg);
  --color-muted-foreground: var(--eui-fg-muted);
  --color-border: var(--eui-border);
  --color-input: var(--eui-input-border);
  --color-primary: var(--eui-primary);
  --color-primary-foreground: var(--eui-primary-fg);
  --color-accent: var(--eui-accent);
  --color-accent-foreground: var(--eui-accent-fg);
  --color-destructive: var(--eui-destructive);
  --color-destructive-foreground: var(--eui-destructive-fg);
  --color-ring: var(--eui-ring);
  --color-chart-1: var(--eui-chart-1);
  --color-chart-2: var(--eui-chart-2);
  --color-chart-3: var(--eui-chart-3);
  --color-chart-4: var(--eui-chart-4);
  --color-chart-5: var(--eui-chart-5);
  --color-chart-6: var(--eui-chart-6);
  --radius-sm: var(--eui-radius-sm);
  --radius-md: var(--eui-radius-md);
  --radius-lg: var(--eui-radius-lg);
}
`
}
