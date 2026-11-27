import { HtmlKeyboard } from "@effect/ui/html"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { Scope } from "effect/Scope"

export type ShortcutPlatform = "mac" | "other"

export interface ShortcutBinding {
  readonly key?: string | undefined
  readonly keys?: readonly [string, ...ReadonlyArray<string>] | undefined
  readonly mod?: boolean | undefined
  readonly ctrl?: boolean | undefined
  readonly alt?: boolean | undefined
  readonly meta?: boolean | undefined
  readonly shift?: boolean | undefined
}

export interface ShortcutMetadata extends ShortcutBinding {
  readonly id: string
  readonly label: string
  readonly group?: string | undefined
  readonly scope?: string | undefined
}

export interface ShortcutConflict {
  readonly signature: string
  readonly scope: string
  readonly ids: ReadonlyArray<string>
}

const displayKey = (key: string, platform: ShortcutPlatform): string => {
  const lower = key.toLowerCase()
  switch (lower) {
    case " ":
    case "space":
      return "Space"
    case "enter":
      return platform === "mac" ? "↵" : "Enter"
    case "escape":
    case "esc":
      return "Esc"
    case "backspace":
      return platform === "mac" ? "⌫" : "Backspace"
    case "delete":
      return platform === "mac" ? "⌦" : "Del"
    case "tab":
      return platform === "mac" ? "⇥" : "Tab"
    case "arrowup":
      return "↑"
    case "arrowdown":
      return "↓"
    case "arrowleft":
      return "←"
    case "arrowright":
      return "→"
    default:
      return key.length === 1 ? key.toUpperCase() : key
  }
}

const ariaKeyToken = (key: string): string => {
  if (key === " ") return "Space"
  if (key === "+") return "Plus"
  return key.length === 1 ? key.toUpperCase() : key
}

const formatSingleCombo = (
  binding: ShortcutBinding,
  key: string,
  platform: ShortcutPlatform
): string => {
  const parts: Array<string> = []
  if (platform === "mac") {
    if (binding.ctrl) parts.push("⌃")
    if (binding.alt) parts.push("⌥")
    if (binding.shift) parts.push("⇧")
    if (binding.mod || binding.meta) parts.push("⌘")
    parts.push(displayKey(key, platform))
    return parts.join("")
  }
  if (binding.mod || binding.ctrl) parts.push("Ctrl")
  if (binding.alt) parts.push("Alt")
  if (binding.shift) parts.push("Shift")
  if (binding.meta && !binding.mod) parts.push("Meta")
  parts.push(displayKey(key, platform))
  return parts.join("+")
}

/**
 * Formats a shortcut or key sequence for display (`⌘K` on macOS, `Ctrl+K` on
 * Windows/Linux, `G then D` for sequences).
 */
export const formatShortcut = (
  binding: ShortcutBinding,
  platform: ShortcutPlatform = "other"
): string => {
  if (binding.keys !== undefined && binding.keys.length > 0) {
    return binding.keys
      .map((k) => formatSingleCombo(binding, k, platform))
      .join(" then ")
  }
  if (binding.key === undefined) return ""
  return formatSingleCombo(binding, binding.key, platform)
}

const ariaSingleCombo = (
  binding: ShortcutBinding,
  key: string,
  modKey?: "Control" | "Meta"
): string => {
  const parts: Array<string> = []
  if (modKey === "Control" || (!modKey && binding.ctrl)) parts.push("Control")
  if (binding.alt) parts.push("Alt")
  if (binding.shift) parts.push("Shift")
  if (modKey === "Meta" || (!modKey && binding.meta)) parts.push("Meta")
  parts.push(ariaKeyToken(key))
  return parts.join("+")
}

/**
 * Produces a WAI-ARIA `aria-keyshortcuts` attribute string (for example
 * `"Control+K Meta+K"` for `{ mod: true, key: "k" }`).
 */
export const ariaKeyshortcuts = (binding: ShortcutBinding): string => {
  const sequence =
    binding.keys !== undefined && binding.keys.length > 0
      ? binding.keys
      : binding.key !== undefined
      ? [binding.key]
      : []
  if (sequence.length === 0) return ""
  if (binding.mod) {
    const ctrl = sequence.map((k) => ariaSingleCombo(binding, k, "Control")).join(" ")
    const meta = sequence.map((k) => ariaSingleCombo(binding, k, "Meta")).join(" ")
    return `${ctrl} ${meta}`
  }
  return sequence.map((k) => ariaSingleCombo(binding, k)).join(" ")
}

const signatureOf = (binding: ShortcutBinding): string => {
  const mods = [
    binding.mod ? "mod" : "",
    binding.ctrl ? "ctrl" : "",
    binding.alt ? "alt" : "",
    binding.shift ? "shift" : "",
    binding.meta ? "meta" : ""
  ]
    .filter(Boolean)
    .join("+")
  const keys =
    binding.keys !== undefined
      ? binding.keys.map((k) => k.toLowerCase()).join(" ")
      : (binding.key ?? "").toLowerCase()
  return mods.length > 0 ? `${mods}+${keys}` : keys
}

export interface ShortcutRegistryService {
  /** Registers shortcut metadata for the lifetime of the current `Scope`. */
  readonly register: (
    entry: ShortcutMetadata
  ) => Effect.Effect<void, never, Scope>
  /** Lists all currently active shortcuts in registration order. */
  readonly list: Effect.Effect<ReadonlyArray<ShortcutMetadata>>
  /** Reports any duplicate key bindings registered in the same scope. */
  readonly conflicts: Effect.Effect<ReadonlyArray<ShortcutConflict>>
}

export class ShortcutRegistry extends Context.Service<
  ShortcutRegistry,
  ShortcutRegistryService
>()("effect-ui-page/ShortcutRegistry") {}

export const makeShortcutRegistry = (): Effect.Effect<ShortcutRegistryService> =>
  Effect.sync(() => {
    const entries = new Map<string, ShortcutMetadata>()

    const register = (entry: ShortcutMetadata): Effect.Effect<void, never, Scope> =>
      Effect.acquireRelease(
        Effect.sync(() => {
          entries.set(entry.id, entry)
        }),
        () =>
          Effect.sync(() => {
            if (entries.get(entry.id) === entry) {
              entries.delete(entry.id)
            }
          })
      )

    const list: Effect.Effect<ReadonlyArray<ShortcutMetadata>> = Effect.sync(() =>
      Array.from(entries.values())
    )

    const conflicts: Effect.Effect<ReadonlyArray<ShortcutConflict>> = Effect.sync(() => {
      const grouped = new Map<string, { scope: string; signature: string; ids: Array<string> }>()
      for (const entry of entries.values()) {
        const scope = entry.scope ?? "global"
        const sig = signatureOf(entry)
        const mapKey = `${scope}::${sig}`
        const bucket = grouped.get(mapKey) ?? { scope, signature: sig, ids: [] }
        bucket.ids.push(entry.id)
        grouped.set(mapKey, bucket)
      }
      const out: Array<ShortcutConflict> = []
      for (const bucket of grouped.values()) {
        if (bucket.ids.length > 1) {
          out.push(bucket)
        }
      }
      return out
    })

    return { register, list, conflicts }
  })

export const shortcutRegistryLayer = (): Layer.Layer<ShortcutRegistry> =>
  Layer.effect(ShortcutRegistry, makeShortcutRegistry())

export interface DocumentedShortcut<Msg> extends HtmlKeyboard.Shortcut<Msg> {
  readonly id: string
  readonly label: string
  readonly group?: string | undefined
  readonly scope?: string | undefined
}

/**
 * Turns a single source-of-truth table of documented shortcuts into both an
 * `@effect/ui` `HtmlKeyboard.shortcuts` handler and metadata entries for
 * `ShortcutRegistry` and `aria-keyshortcuts`.
 */
export const createShortcutTable = <
  const Rows extends ReadonlyArray<DocumentedShortcut<unknown>>
>(
  rows: Rows
) => ({
  handler: HtmlKeyboard.shortcuts(rows),
  metadata: rows.map(
    ({ alt, ctrl, group, id, key, label, meta, mod, scope, shift }): ShortcutMetadata => ({
      id,
      label,
      key,
      mod,
      ctrl,
      alt,
      meta,
      shift,
      group,
      scope
    })
  )
})
