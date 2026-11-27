import { Html } from "@effect/ui/html"
import type { TestHost } from "@effect/ui/testing"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { NodeLike } from "./types.js"

export interface FocusTrackerService {
  readonly activeElement: () => TestHost.TestElement | undefined
  readonly focus: (element: TestHost.TestElement) => boolean
  readonly blur: (element?: TestHost.TestElement) => boolean
  readonly clear: () => void
}

/**
 * Tracks simulated `activeElement` on `TestHost` and wires `Html.Host.focus`
 * / `Html.Host.blur` so `HtmlCommand.focus(ref)` moves focus and fires
 * `focus` / `blur` handlers without a DOM.
 */
export class FocusTracker extends Context.Service<
  FocusTracker,
  FocusTrackerService
>()("effect-ui-a11y/FocusTracker") {}

const isTestElement = (value: unknown): value is TestHost.TestElement =>
  typeof value === "object" &&
  value !== null &&
  (value as { readonly _tag?: unknown })._tag === "Element"

const tryFireOwn = (
  element: TestHost.TestElement,
  event: "focus" | "blur"
): boolean => {
  if (!Object.hasOwn(element.handlers, event)) return false
  try {
    element.fire(event, {})
    return true
  } catch {
    return false
  }
}

export const makeFocusTracker = (): FocusTrackerService => {
  let current: TestHost.TestElement | undefined = undefined

  const focus = (element: TestHost.TestElement): boolean => {
    if (current === element) return true
    const prev = current
    current = element
    let fired = false
    if (prev !== undefined) {
      fired = tryFireOwn(prev, "blur") || fired
    }
    fired = tryFireOwn(element, "focus") || fired
    return fired
  }

  const blur = (element?: TestHost.TestElement): boolean => {
    const target = element ?? current
    if (target === undefined) return false
    if (current === target) current = undefined
    return tryFireOwn(target, "blur")
  }

  return {
    activeElement: () => current,
    focus,
    blur,
    clear: () => {
      current = undefined
    }
  }
}

const zeroRect: Html.Rect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
}

/**
 * Provides both `FocusTracker` and a focus-tracking `Html.Host` for `TestHost`.
 * Merge with `TestHost.layer()` to enable `HtmlCommand.focus` tracking in
 * zero-DOM `HtmlPlay` tests.
 */
export const layer = (): Layer.Layer<FocusTracker | Html.Host> =>
  Layer.effectContext(
    Effect.sync(() => {
      const tracker = makeFocusTracker()
      const host = {
        focus: (element: globalThis.Element) => {
          if (isTestElement(element)) {
            tracker.focus(element)
          }
        },
        blur: (element: globalThis.Element) => {
          if (isTestElement(element)) {
            tracker.blur(element)
          }
        },
        scrollIntoView: () => {},
        measure: () => zeroRect,
        select: () => {},
        requestSubmit: () => false,
        showPicker: () => false
      }
      return Context.make(FocusTracker, tracker).pipe(
        Context.add(Html.Host, host)
      )
    })
  )

export const isSameNode = (
  a: NodeLike | undefined,
  b: NodeLike | undefined
): boolean => a !== undefined && b !== undefined && a === b
