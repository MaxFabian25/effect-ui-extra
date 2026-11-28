import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  composeVisualPreset,
  generateIconModule,
  generatePresetCss,
  listVisualPresets,
  VISUAL_PRESETS
} from "../../src/registry/index.js"
import {
  DEFAULT_DARK_TOKENS,
  DEFAULT_LIGHT_TOKENS,
  SCALE_STEPS,
  TOKEN_CSS_NAMES,
  apcaContrast,
  auditThemeContrast,
  clampToGamut,
  formatHex,
  formatOklch,
  generateScale,
  generateThemeCss,
  isInP3Gamut,
  isInSrgbGamut,
  meetsUiControlContrast,
  meetsWcagAA,
  meetsWcagAAA,
  mixOklch,
  parseColor,
  themeContrastPairs,
  wcagContrast
} from "../../src/theme/index.js"

const cssPath = resolve(import.meta.dir, "../../styles/effect-ui.css")
const stylesheet = readFileSync(cssPath, "utf8")

describe("OKLCH / sRGB / Display-P3 color engine", () => {
  test("hex <-> OKLCH round-trip preserves exact sRGB hex", () => {
    for (const hex of ["#000000", "#ffffff", "#2563eb", "#dc2626", "#16a34a", "#f59e0b"]) {
      const parsed = parseColor(hex)
      expect(parsed).toBeDefined()
      expect(formatHex(parsed!)).toBe(hex)
    }
  })

  test("parseColor handles oklch, percentage L, alpha, rgb, and rejects invalid strings", () => {
    const a = parseColor("oklch(50% 0.16 260 / 50%)")
    expect(a).toEqual({ l: 0.5, c: 0.16, h: 260, alpha: 0.5 })
    expect(formatOklch(a!)).toBe("oklch(0.5 0.16 260 / 0.5)")

    const b = parseColor("rgba(37, 99, 235, 0.8)")
    expect(b).toBeDefined()
    expect(b!.alpha).toBe(0.8)

    expect(parseColor("not-a-color")).toBeUndefined()
    expect(parseColor("#12345")).toBeUndefined()
  })

  test("clampToGamut removes out-of-gamut chroma without hue or lightness drift", () => {
    const vivid = { l: 0.65, c: 0.35, h: 145, alpha: 1 }
    expect(isInSrgbGamut(vivid)).toBe(false)

    const srgbClamped = clampToGamut(vivid, "srgb")
    const p3Clamped = clampToGamut(vivid, "p3")

    expect(isInSrgbGamut(srgbClamped)).toBe(true)
    expect(isInP3Gamut(p3Clamped)).toBe(true)
    expect(srgbClamped.l).toBe(vivid.l)
    expect(srgbClamped.h).toBe(vivid.h)
    expect(p3Clamped.c).toBeGreaterThan(srgbClamped.c)
  })

  test("mixOklch interpolates along the shorter hue arc", () => {
    const a = { l: 0.6, c: 0.15, h: 350, alpha: 1 }
    const b = { l: 0.6, c: 0.15, h: 10, alpha: 1 }
    const mid = mixOklch(a, b, 0.5)
    expect(mid.h).toBe(0)
    expect(mid.l).toBe(0.6)
  })

  test("generateScale produces 11 strictly descending lightness steps all in sRGB gamut", () => {
    const scale = generateScale(260, 0.19, "srgb")
    let prevL = 1
    for (const step of SCALE_STEPS) {
      const color = scale[step]
      expect(isInSrgbGamut(color)).toBe(true)
      expect(color.l).toBeLessThan(prevL)
      expect(color.h).toBe(260)
      prevL = color.l
    }
  })
})

describe("WCAG 2.1 and APCA contrast math", () => {
  test("wcagContrast matches WCAG reference bounds and alpha compositing", () => {
    expect(wcagContrast("#000000", "#ffffff")).toBe(21)
    expect(wcagContrast("#ffffff", "#ffffff")).toBe(1)
    expect(meetsWcagAA("#000000", "#ffffff")).toBe(true)
    expect(meetsWcagAAA("#000000", "#ffffff")).toBe(true)
    expect(meetsUiControlContrast("#767676", "#ffffff")).toBe(true)

    const opaque = wcagContrast("oklch(0.18 0.014 260)", "oklch(0.99 0.002 260)")
    const translucent = wcagContrast("oklch(0.18 0.014 260 / 0.35)", "oklch(0.99 0.002 260)")
    expect(translucent).toBeLessThan(opaque)
    expect(translucent).toBeGreaterThan(1)
  })

  test("apcaContrast preserves polarity (+ dark on light, - light on dark)", () => {
    const darkOnLight = apcaContrast("#111111", "#ffffff")
    const lightOnDark = apcaContrast("#ffffff", "#111111")
    expect(darkOnLight).toBeGreaterThan(95)
    expect(lightOnDark).toBeLessThan(-95)
  })

  test("meetsWcagAA and meetsUiControlContrast reject sub-threshold ratios instead of rounding up", () => {
    const almostAA = "oklch(0.5681 0 0)"
    expect(wcagContrast(almostAA, "#ffffff")).toBe(4.5)
    expect(meetsWcagAA(almostAA, "#ffffff")).toBe(false)

    const almostUI = "oklch(0.6695 0 0)"
    expect(wcagContrast(almostUI, "#ffffff")).toBe(3)
    expect(meetsUiControlContrast(almostUI, "#ffffff")).toBe(false)
  })

  test("DEFAULT_DARK_TOKENS meet APCA >= Lc 60 for mutedForeground and destructive controls", () => {
    expect(Math.abs(apcaContrast(DEFAULT_DARK_TOKENS.mutedForeground, DEFAULT_DARK_TOKENS.background))).toBeGreaterThanOrEqual(60)
    expect(Math.abs(apcaContrast(DEFAULT_DARK_TOKENS.mutedForeground, DEFAULT_DARK_TOKENS.muted))).toBeGreaterThanOrEqual(60)
    expect(Math.abs(apcaContrast(DEFAULT_DARK_TOKENS.destructiveForeground, DEFAULT_DARK_TOKENS.destructive))).toBeGreaterThanOrEqual(60)
    expect(Math.abs(apcaContrast(DEFAULT_DARK_TOKENS.destructive, DEFAULT_DARK_TOKENS.background))).toBeGreaterThanOrEqual(60)
  })
})

describe("Default OKLCH theme tokens and @layer effect-ui stylesheet", () => {
  test("every default light and dark token lies inside sRGB gamut", () => {
    for (const [mode, tokens] of [
      ["light", DEFAULT_LIGHT_TOKENS],
      ["dark", DEFAULT_DARK_TOKENS]
    ] as const) {
      for (const [name, value] of Object.entries(tokens)) {
        const parsed = parseColor(value)
        expect(parsed, `${mode}.${name} should parse`).toBeDefined()
        expect(isInSrgbGamut(parsed!), `${mode}.${name} (${value}) should be in sRGB gamut`).toBe(
          true
        )
      }
    }
  })

  test("DEFAULT_LIGHT_TOKENS and DEFAULT_DARK_TOKENS pass 100% of WCAG AA and UI contrast pairs", () => {
    const lightFailures = auditThemeContrast(themeContrastPairs(DEFAULT_LIGHT_TOKENS))
    const darkFailures = auditThemeContrast(themeContrastPairs(DEFAULT_DARK_TOKENS))
    expect(lightFailures).toEqual([])
    expect(darkFailures).toEqual([])
  })

  test("planted-error check: auditThemeContrast catches low-contrast text, control border, and focus ring", () => {
    const plantedLight = {
      ...DEFAULT_LIGHT_TOKENS,
      mutedForeground: "oklch(0.75 0.01 260)", // fails >= 4.5:1 on light surfaces
      inputBorder: "oklch(0.85 0.008 260)" // fails >= 3.0:1 on light background/surface
    }
    const lightFailures = auditThemeContrast(themeContrastPairs(plantedLight))
    const lightNames = lightFailures.map((f) => f.name)
    expect(lightNames).toContain("mutedForeground on background")
    expect(lightNames).toContain("mutedForeground on muted")
    expect(lightNames).toContain("inputBorder on background")

    const plantedDark = {
      ...DEFAULT_DARK_TOKENS,
      ring: "oklch(0.32 0.04 260)" // fails >= 3.0:1 on dark background/surface
    }
    const darkFailures = auditThemeContrast(themeContrastPairs(plantedDark))
    const darkNames = darkFailures.map((f) => f.name)
    expect(darkNames).toContain("ring on background")
    expect(darkNames).toContain("ring on surface")
  })

  test("styles/effect-ui.css stays in sync with DEFAULT_LIGHT_TOKENS and DEFAULT_DARK_TOKENS", () => {
    expect(stylesheet).toContain("@layer effect-ui {")
    expect(stylesheet).toContain(':root[data-color-scheme="light"]')
    expect(stylesheet).toContain(':root[data-color-scheme="dark"]')
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)")
    expect(stylesheet).not.toContain("0.01ms !important")
    expect(stylesheet).toContain("@media (prefers-color-scheme: dark)")
    expect(stylesheet).toContain("@supports not (color: light-dark(white, black))")
    expect(stylesheet).toContain("@supports (color: light-dark(white, black))")
    expect(stylesheet).toContain("@media (hover: hover) and (pointer: fine)")
    expect(stylesheet).toContain("@media (pointer: coarse)")
    expect(stylesheet).toContain("overscroll-behavior: contain")
    expect(stylesheet).toContain('[data-highlighted="true"]')
    expect(stylesheet).toContain('[data-highlighted=""]')
    expect(stylesheet).toContain("[data-overlay-viewport]")
    expect(stylesheet).toContain("[data-overlay-actions]")
    expect(stylesheet).toContain('[role="switch"] > span')
    expect(stylesheet).toContain("translateX(1rem)")
    expect(stylesheet).toContain("rotate(180deg)")
    expect(stylesheet).toContain("--eui-duration-fast: 100ms")
    expect(stylesheet).toContain("--eui-duration-motion: 0ms")
    expect(stylesheet).toContain("color-mix(in oklab,")
    expect(stylesheet).not.toContain("color-mix(in oklch,")
    expect(stylesheet).not.toContain("font-synthesis: none")
    expect(stylesheet).not.toContain("scrollbar-color:")
    expect(stylesheet).toContain("--eui-chart-1:")
    expect(stylesheet).toContain("--eui-chart-6:")
    expect(stylesheet).toContain("--eui-z-dropdown: 100")
    expect(stylesheet).toContain("[data-image-cropper]")
    expect(stylesheet).toContain("[data-area-picker]")
    expect(stylesheet).toContain("[data-waterfall]")
    expect(stylesheet).toContain("[data-carousel]")
    expect(stylesheet).toContain("[data-timeline]")
    expect(stylesheet).toContain("[data-scroll-picker]")
    expect(stylesheet).toContain("[data-datetime-picker]")
    expect(stylesheet).toContain("[data-trigger-menu]")
    expect(stylesheet).toContain("direction: ltr")
    expect(stylesheet).toContain("[data-segmented-control]")
    expect(stylesheet).toContain("[data-rating]")
    expect(stylesheet).toContain("[data-resize-handle]")
    expect(stylesheet).toContain("[data-time-input]")
    expect(stylesheet).toContain('[aria-current="page"]')
    expect(stylesheet).toContain("@media (forced-colors: active)")
    expect(stylesheet).toContain("forced-color-adjust: none")

    // Zero ::before/::after icon-content hacks (universal box-sizing selector is allowed).
    expect(stylesheet).not.toMatch(/(?<![\w-])content\s*:/)

    for (const key of Object.keys(TOKEN_CSS_NAMES) as ReadonlyArray<keyof typeof TOKEN_CSS_NAMES>) {
      const cssVar = TOKEN_CSS_NAMES[key]
      const expected = `${cssVar}: light-dark(${DEFAULT_LIGHT_TOKENS[key]}, ${DEFAULT_DARK_TOKENS[key]});`
      expect(stylesheet).toContain(expected)
    }
  })

  test("generateThemeCss outputs valid @layer light-dark CSS with fallbacks for custom tokens", () => {
    const css = generateThemeCss(DEFAULT_LIGHT_TOKENS, DEFAULT_DARK_TOKENS, {
      layer: "brand-theme"
    })
    expect(css).toContain("@layer brand-theme {")
    expect(css).toContain("@supports not (color: light-dark(white, black))")
    expect(css).toContain("@media (prefers-color-scheme: dark)")
    expect(css).toContain("@supports (color: light-dark(white, black))")
    expect(css).toContain(`--eui-primary: ${DEFAULT_LIGHT_TOKENS.primary};`)
    expect(css).toContain(`--eui-primary: ${DEFAULT_DARK_TOKENS.primary};`)
    expect(css).toContain(`--eui-primary: light-dark(${DEFAULT_LIGHT_TOKENS.primary}, ${DEFAULT_DARK_TOKENS.primary});`)
  })

  test("all 8 visual presets, chart palettes, and 240 composed combos stay inside sRGB gamut and pass WCAG AA", () => {
    const presets = listVisualPresets()
    expect(presets.length).toBe(8)

    // Maia light primary and destructive hues stay separated by >= 15 degrees
    const maiaPrimary = parseColor(VISUAL_PRESETS.maia.light.primary)!
    const maiaDest = parseColor(VISUAL_PRESETS.maia.light.destructive)!
    expect(maiaPrimary.h).toBeGreaterThanOrEqual(42)
    expect(maiaDest.h).toBeLessThanOrEqual(22)
    expect(Math.abs(maiaPrimary.h - maiaDest.h)).toBeGreaterThanOrEqual(15)

    for (const preset of presets) {
      for (const chart of [...preset.chartLight, ...preset.chartDark]) {
        const parsed = parseColor(chart)!
        expect(isInSrgbGamut(parsed), `${preset.name} chart ${chart}`).toBe(true)
      }
      const css = generatePresetCss(preset.name)
      expect(css).toContain("@media (prefers-reduced-motion: reduce)")
      expect(css).toContain("@media (forced-colors: active)")
      expect(css).toContain("@media (pointer: coarse)")
      expect(css).toContain("--ease-eui:")
      expect(css).toContain("--ease-sheet:")
      expect(css).toContain("--z-dropdown: 100")
    }

    const styles = ["nova", "vega", "maia", "lyra", "mira", "luma", "rhea", "sera"] as const
    const bases = ["neutral", "slate", "zinc", "stone", "gray"] as const
    const accents = ["default", "blue", "emerald", "amber", "rose", "violet"] as const
    for (const style of styles) {
      for (const baseColor of bases) {
        for (const accent of accents) {
          const composed = composeVisualPreset({ style, baseColor, accent, radius: "md" })
          for (const mode of ["light", "dark"] as const) {
            for (const [k, v] of Object.entries(composed[mode])) {
              expect(
                isInSrgbGamut(parseColor(v)!),
                `${style}/${baseColor}/${accent} ${mode}.${k}=${v}`
              ).toBe(true)
            }
            expect(
              auditThemeContrast(themeContrastPairs(composed[mode])),
              `${style}/${baseColor}/${accent} ${mode}`
            ).toEqual([])
          }
        }
      }
    }

    const icons = generateIconModule("lucide")
    expect(icons).toContain("chevronLeft")
    expect(icons).toContain("chevronUp")
    expect(icons).toContain("alertCircle")
    expect(icons).toContain("arrowUpDown")
    expect(icons).toContain("M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4-4")
    expect(icons).toContain("rtl:-scale-x-100")
  })
})
