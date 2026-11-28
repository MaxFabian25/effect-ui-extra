import {
  DEFAULT_DARK_TOKENS,
  DEFAULT_LIGHT_TOKENS,
  generateThemeCss,
  type ThemeTokens
} from "../theme/tokens.js"
import {
  type AccentColor,
  type BaseColor,
  decodePresetSpec,
  type PresetName,
  type PresetSpec,
  type RadiusScale
} from "./schema.js"

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
  },
  luma: {
    name: "luma",
    title: "Luma",
    description: "Warm ivory canvas paired with deep botanical emerald actions and airy spacing.",
    radiusSm: "0.5rem",
    radiusMd: "0.75rem",
    radiusLg: "1rem",
    density: "spacious",
    fontSans: SANS_DEFAULT,
    fontMono: MONO_DEFAULT,
    light: {
      background: "oklch(0.99 0.004 95)",
      surface: "oklch(0.96 0.008 95)",
      muted: "oklch(0.925 0.01 95)",
      foreground: "oklch(0.19 0.015 150)",
      mutedForeground: "oklch(0.44 0.016 150)",
      border: "oklch(0.84 0.012 95)",
      inputBorder: "oklch(0.55 0.018 150)",
      primary: "oklch(0.43 0.13 155)",
      primaryForeground: "oklch(0.99 0.003 95)",
      accent: "oklch(0.91 0.028 155)",
      accentForeground: "oklch(0.22 0.05 155)",
      destructive: "oklch(0.49 0.19 26)",
      destructiveForeground: "oklch(0.99 0.002 26)",
      ring: "oklch(0.46 0.13 155)"
    },
    dark: {
      background: "oklch(0.15 0.01 155)",
      surface: "oklch(0.2 0.012 155)",
      muted: "oklch(0.25 0.014 155)",
      foreground: "oklch(0.955 0.006 95)",
      mutedForeground: "oklch(0.755 0.012 140)",
      border: "oklch(0.32 0.014 155)",
      inputBorder: "oklch(0.61 0.018 155)",
      primary: "oklch(0.74 0.13 155)",
      primaryForeground: "oklch(0.14 0.015 155)",
      accent: "oklch(0.28 0.032 155)",
      accentForeground: "oklch(0.94 0.015 145)",
      destructive: "oklch(0.7 0.16 25)",
      destructiveForeground: "oklch(0.15 0.01 25)",
      ring: "oklch(0.74 0.13 155)"
    },
    chartLight: CHART_LIGHT_DEFAULT,
    chartDark: CHART_DARK_DEFAULT
  },
  rhea: {
    name: "rhea",
    title: "Rhea",
    description: "Editorial soft rose-ivory palette with high-contrast plum accents.",
    radiusSm: "0.375rem",
    radiusMd: "0.625rem",
    radiusLg: "0.875rem",
    density: "comfortable",
    fontSans: SANS_DEFAULT,
    fontMono: MONO_DEFAULT,
    light: {
      background: "oklch(0.99 0.004 345)",
      surface: "oklch(0.96 0.008 345)",
      muted: "oklch(0.925 0.012 345)",
      foreground: "oklch(0.19 0.018 330)",
      mutedForeground: "oklch(0.44 0.02 330)",
      border: "oklch(0.84 0.014 340)",
      inputBorder: "oklch(0.55 0.022 330)",
      primary: "oklch(0.44 0.16 340)",
      primaryForeground: "oklch(0.99 0.002 340)",
      accent: "oklch(0.91 0.028 340)",
      accentForeground: "oklch(0.24 0.06 340)",
      destructive: "oklch(0.49 0.19 25)",
      destructiveForeground: "oklch(0.99 0.002 25)",
      ring: "oklch(0.48 0.15 340)"
    },
    dark: {
      background: "oklch(0.155 0.012 330)",
      surface: "oklch(0.205 0.014 330)",
      muted: "oklch(0.25 0.016 330)",
      foreground: "oklch(0.955 0.006 345)",
      mutedForeground: "oklch(0.755 0.014 340)",
      border: "oklch(0.325 0.016 330)",
      inputBorder: "oklch(0.61 0.02 330)",
      primary: "oklch(0.74 0.14 345)",
      primaryForeground: "oklch(0.15 0.015 330)",
      accent: "oklch(0.285 0.035 335)",
      accentForeground: "oklch(0.94 0.018 345)",
      destructive: "oklch(0.7 0.16 25)",
      destructiveForeground: "oklch(0.15 0.012 25)",
      ring: "oklch(0.74 0.14 345)"
    },
    chartLight: CHART_LIGHT_DEFAULT,
    chartDark: CHART_DARK_DEFAULT
  },
  sera: {
    name: "sera",
    title: "Sera",
    description: "Compact crisp slate and deep cyan-teal palette tuned for operational dashboards.",
    radiusSm: "0.25rem",
    radiusMd: "0.375rem",
    radiusLg: "0.5rem",
    density: "compact",
    fontSans: SANS_DEFAULT,
    fontMono: MONO_DEFAULT,
    light: {
      background: "oklch(0.99 0.002 210)",
      surface: "oklch(0.96 0.005 210)",
      muted: "oklch(0.928 0.008 210)",
      foreground: "oklch(0.185 0.016 215)",
      mutedForeground: "oklch(0.44 0.016 215)",
      border: "oklch(0.84 0.01 210)",
      inputBorder: "oklch(0.55 0.018 215)",
      primary: "oklch(0.43 0.12 205)",
      primaryForeground: "oklch(0.99 0.002 210)",
      accent: "oklch(0.91 0.025 205)",
      accentForeground: "oklch(0.22 0.05 205)",
      destructive: "oklch(0.5 0.19 27)",
      destructiveForeground: "oklch(0.99 0.002 27)",
      ring: "oklch(0.46 0.12 205)"
    },
    dark: {
      background: "oklch(0.15 0.01 215)",
      surface: "oklch(0.2 0.012 215)",
      muted: "oklch(0.248 0.014 215)",
      foreground: "oklch(0.955 0.005 210)",
      mutedForeground: "oklch(0.755 0.012 210)",
      border: "oklch(0.32 0.014 215)",
      inputBorder: "oklch(0.61 0.018 215)",
      primary: "oklch(0.74 0.12 205)",
      primaryForeground: "oklch(0.14 0.014 215)",
      accent: "oklch(0.28 0.03 210)",
      accentForeground: "oklch(0.94 0.015 205)",
      destructive: "oklch(0.7 0.16 25)",
      destructiveForeground: "oklch(0.15 0.012 25)",
      ring: "oklch(0.74 0.12 205)"
    },
    chartLight: CHART_LIGHT_DEFAULT,
    chartDark: CHART_DARK_DEFAULT
  }
}

const RADIUS_SCALES: Readonly<Record<RadiusScale, { readonly sm: string; readonly md: string; readonly lg: string }>> = {
  none: { sm: "0px", md: "0px", lg: "0px" },
  sm: { sm: "0.125rem", md: "0.25rem", lg: "0.375rem" },
  md: { sm: "0.375rem", md: "0.5rem", lg: "0.75rem" },
  lg: { sm: "0.5rem", md: "0.75rem", lg: "1rem" },
  full: { sm: "0.75rem", md: "1rem", lg: "1.5rem" }
}

const ACCENT_OVERRIDES: Readonly<
  Record<
    Exclude<AccentColor, "default">,
    {
      readonly light: Pick<ThemeTokens, "primary" | "primaryForeground" | "ring">
      readonly dark: Pick<ThemeTokens, "primary" | "primaryForeground" | "ring">
    }
  >
> = {
  blue: {
    light: { primary: "oklch(0.45 0.17 258)", primaryForeground: "oklch(0.99 0.002 258)", ring: "oklch(0.48 0.17 258)" },
    dark: { primary: "oklch(0.74 0.14 258)", primaryForeground: "oklch(0.15 0.014 258)", ring: "oklch(0.74 0.14 258)" }
  },
  emerald: {
    light: { primary: "oklch(0.43 0.13 155)", primaryForeground: "oklch(0.99 0.002 155)", ring: "oklch(0.46 0.13 155)" },
    dark: { primary: "oklch(0.74 0.13 155)", primaryForeground: "oklch(0.14 0.015 155)", ring: "oklch(0.74 0.13 155)" }
  },
  amber: {
    light: { primary: "oklch(0.47 0.14 60)", primaryForeground: "oklch(0.99 0.003 60)", ring: "oklch(0.5 0.14 60)" },
    dark: { primary: "oklch(0.78 0.14 72)", primaryForeground: "oklch(0.16 0.015 60)", ring: "oklch(0.78 0.14 72)" }
  },
  rose: {
    light: { primary: "oklch(0.46 0.18 12)", primaryForeground: "oklch(0.99 0.002 12)", ring: "oklch(0.49 0.18 12)" },
    dark: { primary: "oklch(0.73 0.15 12)", primaryForeground: "oklch(0.15 0.015 12)", ring: "oklch(0.73 0.15 12)" }
  },
  violet: {
    light: { primary: "oklch(0.45 0.18 292)", primaryForeground: "oklch(0.99 0.002 292)", ring: "oklch(0.48 0.18 292)" },
    dark: { primary: "oklch(0.74 0.15 292)", primaryForeground: "oklch(0.15 0.015 292)", ring: "oklch(0.74 0.15 292)" }
  }
}

const BASE_COLOR_HUES: Readonly<Record<BaseColor, { readonly chroma: number; readonly hue: number }>> = {
  neutral: { chroma: 0, hue: 0 },
  slate: { chroma: 0.012, hue: 250 },
  zinc: { chroma: 0.004, hue: 260 },
  stone: { chroma: 0.01, hue: 65 },
  gray: { chroma: 0.006, hue: 245 }
}

/** Encodes a composable `PresetSpec` into a compact shareable code (e.g. `v1-nova-slate-blue-md`). */
export const encodePresetCode = (spec: PresetSpec): string =>
  `v1-${spec.style}-${spec.baseColor}-${spec.accent}-${spec.radius}`

/** Decodes and validates a shareable preset code created by `encodePresetCode`. */
export const decodePresetCode = (code: string): PresetSpec => {
  const parts = code.trim().toLowerCase().split("-")
  if (parts.length !== 5 || parts[0] !== "v1") {
    throw new Error(`Invalid preset code "${code}". Expected format: v1-<style>-<baseColor>-<accent>-<radius>.`)
  }
  return decodePresetSpec({
    style: parts[1],
    baseColor: parts[2],
    accent: parts[3],
    radius: parts[4]
  })
}

/** Composes a WCAG-safe `VisualPreset` by combining a base style with custom `baseColor`, `accent`, and `radius`. */
export const composeVisualPreset = (spec: PresetSpec): VisualPreset => {
  const base = VISUAL_PRESETS[spec.style]
  const rad = RADIUS_SCALES[spec.radius]
  const accentOverride = spec.accent === "default" ? undefined : ACCENT_OVERRIDES[spec.accent]
  const bh = BASE_COLOR_HUES[spec.baseColor]
  const light: ThemeTokens = {
    ...base.light,
    surface: `oklch(0.962 ${bh.chroma} ${bh.hue})`,
    muted: `oklch(0.93 ${bh.chroma} ${bh.hue})`,
    ...(accentOverride !== undefined ? accentOverride.light : {})
  }
  const dark: ThemeTokens = {
    ...base.dark,
    surface: `oklch(0.205 ${bh.chroma} ${bh.hue})`,
    muted: `oklch(0.25 ${bh.chroma} ${bh.hue})`,
    ...(accentOverride !== undefined ? accentOverride.dark : {})
  }
  return {
    ...base,
    radiusSm: rad.sm,
    radiusMd: rad.md,
    radiusLg: rad.lg,
    light,
    dark
  }
}

export const getVisualPreset = (name: PresetName): VisualPreset => VISUAL_PRESETS[name]

export const listVisualPresets = (): ReadonlyArray<VisualPreset> =>
  Object.values(VISUAL_PRESETS)

const renderPresetCss = (preset: VisualPreset, headerLabel: string): string => {
  const baseCss = generateThemeCss(preset.light, preset.dark)
  const chartLightDecls = preset.chartLight
    .map((c, i) => `    --eui-chart-${i + 1}: ${c};`)
    .join("\n")
  const chartDarkDecls = preset.chartDark
    .map((c, i) => `    --eui-chart-${i + 1}: ${c};`)
    .join("\n")

  return `/* effect-ui preset: ${headerLabel} */
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

/**
 * Generates a Tailwind v4 `@theme inline` + `@layer effect-ui` stylesheet for
 * the selected visual preset with full light/dark fallbacks and chart tokens.
 */
export const generatePresetCss = (name: PresetName): string => {
  const preset = VISUAL_PRESETS[name]
  return renderPresetCss(preset, `${preset.name} (${preset.title}) — ${preset.description}`)
}

/** Generates Tailwind v4 CSS for a custom composable `PresetSpec` (or shareable code). */
export const generateCustomPresetCss = (specOrCode: PresetSpec | string): string => {
  const spec = typeof specOrCode === "string" ? decodePresetCode(specOrCode) : specOrCode
  const composed = composeVisualPreset(spec)
  return renderPresetCss(composed, encodePresetCode(spec))
}
