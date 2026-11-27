import * as Data from "effect/Data"
import type * as Effect from "effect/Effect"
import type { Locator } from "@effect/ui/testing"

/**
 * Supported WAI-ARIA Authoring Practices Guide (APG) widget patterns.
 */
export type ApgPattern =
  | "switch"
  | "checkbox"
  | "disclosure"
  | "accordion"
  | "tabs"
  | "radio-group"
  | "toolbar"
  | "slider"
  | "dialog"
  | "alertdialog"
  | "listbox"
  | "combobox"
  | "menu"
  | "menubar"
  | "tree"

export type Direction = "ltr" | "rtl"
export type Orientation = "horizontal" | "vertical"

/**
 * A single WAI-ARIA APG violation found during an audit.
 */
export interface PatternViolation {
  readonly pattern: ApgPattern
  readonly rule: string
  readonly apg: string
  readonly message: string
  readonly element: string
}

/**
 * Raised by `checkPattern` and `checkDirection` with every violation collected
 * during the audit, rather than failing on the first defect.
 */
export class PatternViolationError extends Data.TaggedError(
  "PatternViolationError"
)<{
  readonly pattern: ApgPattern
  readonly violations: ReadonlyArray<PatternViolation>
}> {
  override get message(): string {
    const header = `${this.pattern}: ${this.violations.length} APG violation${
      this.violations.length === 1 ? "" : "s"
    }`
    const lines = this.violations.map(
      (v, i) => `  ${i + 1}. [${v.rule}] (${v.apg}) ${v.element}: ${v.message}`
    )
    return `${header}\n${lines.join("\n")}`
  }
}

export interface KeyModifiers {
  readonly shift?: boolean | undefined
  readonly ctrl?: boolean | undefined
  readonly alt?: boolean | undefined
  readonly meta?: boolean | undefined
}

export interface CheckPatternOptions {
  /** Text direction for horizontal keyboard checks. Defaults to `"ltr"`. */
  readonly direction?: Direction | undefined
  /** Explicit widget orientation override when not declared via `aria-orientation`. */
  readonly orientation?: Orientation | undefined
  /** Whether arrow navigation is expected to wrap around ends. Defaults to `undefined` (accepts either wrapping or clamping). */
  readonly loop?: boolean | undefined
  /** Check ARIA structure, names, IDREFs, and tab stops only without driving keyboard/click interactions. */
  readonly staticOnly?: boolean | undefined
  /** Accessible name of a trigger button to click first when auditing a closed popup pattern. */
  readonly openTrigger?: string | undefined
  /** Effect run after each DOM interaction to let `BrowserHost` flush and settle. */
  readonly settle?: Effect.Effect<void> | undefined
}

export interface AnyHtmlPlay {
  readonly root: { readonly container: NodeLike }
  click(target: string | Locator.Locator): Effect.Effect<void, unknown>
  keydown(
    locator: Locator.Locator,
    key: string,
    details?: Partial<{
      readonly shift: boolean
      readonly ctrl: boolean
      readonly alt: boolean
      readonly meta: boolean
    }>
  ): Effect.Effect<void, unknown>
  focus(locator: Locator.Locator): Effect.Effect<void, unknown>
  blur(locator: Locator.Locator): Effect.Effect<void, unknown>
  fire(
    locator: Locator.Locator,
    event: string,
    payload?: unknown
  ): Effect.Effect<void, unknown>
  expectIgnored(): Effect.Effect<void>
}

export interface DomTarget {
  readonly container: globalThis.Element
  readonly settle?: Effect.Effect<void> | undefined
}

export type A11yTarget = AnyHtmlPlay | globalThis.Element | DomTarget

export type NodeLike = globalThis.Element | {
  readonly _tag: "Element"
  readonly tag: string
  readonly attrs: Record<string, string>
  readonly props: Record<string, unknown>
  readonly children: ReadonlyArray<unknown>
  readonly parent?: NodeLike | undefined
}

export interface A11yDriver {
  readonly kind: "testhost" | "dom"
  readonly root: () => NodeLike
  readonly activeElement: () => NodeLike | undefined
  readonly click: (node: NodeLike) => Effect.Effect<boolean>
  readonly focus: (node: NodeLike) => Effect.Effect<boolean>
  readonly keydown: (
    node: NodeLike,
    key: string,
    modifiers?: KeyModifiers
  ) => Effect.Effect<boolean>
  readonly keyup: (
    node: NodeLike,
    key: string,
    modifiers?: KeyModifiers
  ) => Effect.Effect<boolean>
}
