import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { preferencesScript } from './preferences.js';
import type { PreferenceSpec } from './preferences.js';

export interface CspConfig {
  /** Nonce applied to inline `<script>` and `<style>` elements. */
  readonly nonce?: string | undefined
  /**
   * When `true`, `cspStyleTag` returns an empty string so strict-CSP apps can
   * ship static CSS files instead of runtime `<style>` tags.
   */
  readonly disableStyleElements?: boolean | undefined
}

/**
 * Effect service equivalent of Base UI's `CSPProvider`. Provide via `cspLayer`
 * per SSR request or app root so helpers pick up the request's CSP nonce
 * without threading it manually through every component.
 */
export class CspContext extends Context.Service<CspContext, CspConfig>()(
  "effect-ui-page/CspContext"
) {}

export const cspLayer = (config: CspConfig): Layer.Layer<CspContext> =>
  Layer.succeed(CspContext, config)

const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

const escapeInlineTagBody = (body: string, tagName: "script" | "style"): string =>
  body.replace(new RegExp(`</${tagName}`, "gi"), `<\\/${tagName}`)

const nonceAttribute = (nonce: string | undefined): string =>
  nonce !== undefined && nonce.length > 0 ? ` nonce="${escapeAttr(nonce)}"` : ""

/**
 * Reads the active `CspConfig` from Effect context if provided, otherwise
 * returns an empty config.
 */
export const getCspConfig: Effect.Effect<CspConfig> = Effect.map(
  Effect.serviceOption(CspContext),
  Option.getOrElse((): CspConfig => ({}))
)

/** Reads the active CSP nonce if provided via `cspLayer`. */
export const getCspNonce: Effect.Effect<string | undefined> = Effect.map(
  getCspConfig,
  (config) => config.nonce
)

/**
 * Emits an inline `<script>` tag with an optional CSP `nonce` attribute and
 * safe `</script` escaping.
 */
export const cspScriptTag = (body: string, config?: CspConfig): string =>
  `<script${nonceAttribute(config?.nonce)}>${escapeInlineTagBody(body, "script")}</script>`

/**
 * Emits an inline `<style>` tag with an optional CSP `nonce` attribute. Returns
 * an empty string when `config.disableStyleElements` is `true`.
 */
export const cspStyleTag = (css: string, config?: CspConfig): string => {
  if (config?.disableStyleElements === true) return ""
  return `<style${nonceAttribute(config?.nonce)}>${escapeInlineTagBody(css, "style")}</style>`
}

/**
 * Emits the zero-FOUC `preferencesScript` `<script>` tag using the active
 * `CspContext` nonce when present.
 */
export const preferencesScriptWithCsp = (
  specs: ReadonlyArray<PreferenceSpec<string>>
): Effect.Effect<string> =>
  Effect.map(getCspNonce, (nonce) => preferencesScript(specs, { nonce }))
