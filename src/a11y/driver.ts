import type { Locator, TestHost } from "@effect/ui/testing"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import {
  containsNode,
  describeNode,
  getAttr,
  getParent,
  getTag,
  isDomElement,
  isHardDisabled,
  isTestElement
} from "./aria.js"
import { FocusTracker, type FocusTrackerService } from "./focus.js"
import type {
  A11yDriver,
  A11yTarget,
  AnyHtmlPlay,
  DomTarget,
  KeyModifiers,
  NodeLike
} from "./types.js"

const isDomTarget = (target: A11yTarget): target is DomTarget =>
  typeof target === "object" &&
  target !== null &&
  "container" in target &&
  isDomElement((target as DomTarget).container)

const isPlayTarget = (target: A11yTarget): target is AnyHtmlPlay =>
  typeof target === "object" &&
  target !== null &&
  "root" in target &&
  typeof (target as AnyHtmlPlay).keydown === "function"

const exactLocator = (
  root: NodeLike,
  node: NodeLike
): Locator.Locator => ({
  description: describeNode(root, node),
  all: <N extends Locator.Node>(searchRoot: N): ReadonlyArray<N> =>
    containsNode(searchRoot as unknown as NodeLike, node)
      ? [node as unknown as N]
      : []
})

const hasPreventDefaultKeydown = (node: NodeLike): boolean => {
  if (!isTestElement(node)) return false
  for (let at: NodeLike | undefined = node; at !== undefined; at = getParent(at)) {
    if (!isTestElement(at)) continue
    const el = at as unknown as TestHost.TestElement
    if (Object.hasOwn(el.handlers, "keydown")) {
      return el.eventOptions.keydown?.preventDefault === true
    }
  }
  return false
}

const isNativeButton = (node: NodeLike): boolean => {
  const tag = getTag(node)
  if (tag === "button") return !isHardDisabled(node)
  if (tag === "input") {
    const type = (getAttr(node, "type") ?? "").toLowerCase()
    return (
      !isHardDisabled(node) &&
      (type === "button" || type === "submit" || type === "reset")
    )
  }
  return false
}

const isNativeCheckbox = (node: NodeLike): boolean =>
  getTag(node) === "input" &&
  (getAttr(node, "type") ?? "").toLowerCase() === "checkbox" &&
  !isHardDisabled(node)

const makePlayDriver = (
  play: AnyHtmlPlay,
  tracker: FocusTrackerService | undefined
): A11yDriver => {
  let localActive: NodeLike | undefined = undefined

  const activeElement = (): NodeLike | undefined =>
    tracker?.activeElement() ?? localActive

  const runStep = (
    step: Effect.Effect<void, unknown, never>
  ): Effect.Effect<{ readonly reached: boolean; readonly handled: boolean }> =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(step)
      if (Exit.isFailure(exit)) {
        return { reached: false, handled: false }
      }
      const ignored = yield* Effect.exit(play.expectIgnored())
      return { reached: true, handled: Exit.isFailure(ignored) }
    })

  const click = (node: NodeLike): Effect.Effect<boolean> =>
    Effect.gen(function*() {
      const loc = exactLocator(play.root.container, node)
      const res = yield* runStep(play.click(loc))
      if (res.reached) return res.handled
      return false
    })

  const keyboardClick = (node: NodeLike): Effect.Effect<boolean> =>
    Effect.gen(function*() {
      const loc = exactLocator(play.root.container, node)
      const res = yield* runStep(
        play.fire(loc, "click", {
          button: 0,
          x: 0,
          y: 0,
          shift: false,
          ctrl: false,
          alt: false,
          meta: false,
          pointerId: -1,
          pointerType: ""
        })
      )
      return res.reached && res.handled
    })

  const focus = (node: NodeLike): Effect.Effect<boolean> =>
    Effect.gen(function*() {
      localActive = node
      if (tracker !== undefined && isTestElement(node)) {
        const prev = tracker.activeElement()
        if (prev !== undefined && prev !== (node as unknown as TestHost.TestElement)) {
          yield* runStep(play.blur(exactLocator(play.root.container, prev)))
        }
        tracker.focus(node as unknown as TestHost.TestElement)
      }
      const loc = exactLocator(play.root.container, node)
      const res = yield* runStep(play.focus(loc))
      return res.reached
    })

  const keydown = (
    node: NodeLike,
    key: string,
    modifiers?: KeyModifiers
  ): Effect.Effect<boolean> =>
    Effect.gen(function*() {
      const loc = exactLocator(play.root.container, node)
      const willPrevent = hasPreventDefaultKeydown(node)
      const details = modifiers === undefined
        ? undefined
        : {
            shift: modifiers.shift ?? false,
            ctrl: modifiers.ctrl ?? false,
            alt: modifiers.alt ?? false,
            meta: modifiers.meta ?? false
          }
      const res = yield* runStep(play.keydown(loc, key, details))
      const prevented = res.handled && willPrevent
      if (!prevented) {
        if ((key === " " || key === "Enter") && isNativeButton(node)) {
          const clicked = yield* keyboardClick(node)
          if (clicked) return true
        } else if (key === " " && isNativeCheckbox(node)) {
          const clicked = yield* click(node)
          if (clicked) return true
        }
      }
      return res.handled
    })

  const keyup = (
    node: NodeLike,
    key: string,
    modifiers?: KeyModifiers
  ): Effect.Effect<boolean> =>
    Effect.gen(function*() {
      const loc = exactLocator(play.root.container, node)
      const res = yield* runStep(
        play.fire(loc, "keyup", {
          key,
          shift: modifiers?.shift ?? false,
          ctrl: modifiers?.ctrl ?? false,
          alt: modifiers?.alt ?? false,
          meta: modifiers?.meta ?? false,
          composing: false,
          repeat: false,
          editable: false,
          selectionStart: null,
          selectionEnd: null
        })
      )
      return res.handled
    })

  return {
    kind: "testhost",
    root: () => play.root.container,
    activeElement,
    click,
    focus,
    keydown,
    keyup
  }
}

const defaultDomSettle: Effect.Effect<void> = Effect.promise(
  () => new Promise<void>((resolve) => setTimeout(resolve, 25))
)

const makeDomDriver = (
  container: globalThis.Element,
  settle: Effect.Effect<void>
): A11yDriver => {
  const doc = container.ownerDocument

  const click = (node: NodeLike): Effect.Effect<boolean> =>
    Effect.gen(function*() {
      if (!isDomElement(node) || isHardDisabled(node)) return false
      const PointerCtor =
        typeof PointerEvent !== "undefined" ? PointerEvent : MouseEvent
      node.dispatchEvent(
        new PointerCtor("pointerdown", {
          bubbles: true,
          cancelable: true,
          composed: true,
          button: 0
        })
      )
      node.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          composed: true,
          button: 0
        })
      )
      yield* settle
      node.dispatchEvent(
        new PointerCtor("pointerup", {
          bubbles: true,
          cancelable: true,
          composed: true,
          button: 0
        })
      )
      node.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          composed: true,
          button: 0
        })
      )
      node.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          composed: true,
          detail: 1,
          button: 0
        })
      )
      yield* settle
      return true
    })

  const focus = (node: NodeLike): Effect.Effect<boolean> =>
    Effect.gen(function*() {
      if (!isDomElement(node) || isHardDisabled(node)) return false
      if (typeof (node as HTMLElement).focus === "function") {
        ;(node as HTMLElement).focus()
      }
      yield* settle
      return doc.activeElement === node
    })

  const keydown = (
    node: NodeLike,
    key: string,
    modifiers?: KeyModifiers
  ): Effect.Effect<boolean> =>
    Effect.gen(function*() {
      if (!isDomElement(node)) return false
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        composed: true,
        shiftKey: modifiers?.shift ?? false,
        ctrlKey: modifiers?.ctrl ?? false,
        altKey: modifiers?.alt ?? false,
        metaKey: modifiers?.meta ?? false
      })
      node.dispatchEvent(event)
      yield* settle
      if (!event.defaultPrevented) {
        if ((key === " " || key === "Enter") && isNativeButton(node)) {
          node.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              composed: true,
              detail: 0,
              button: 0
            })
          )
          yield* settle
          return true
        }
        if (key === " " && isNativeCheckbox(node)) {
          ;(node as HTMLInputElement).checked = !(node as HTMLInputElement).checked
          node.dispatchEvent(new Event("input", { bubbles: true }))
          node.dispatchEvent(new Event("change", { bubbles: true }))
          yield* settle
          return true
        }
      }
      return event.defaultPrevented
    })

  const keyup = (
    node: NodeLike,
    key: string,
    modifiers?: KeyModifiers
  ): Effect.Effect<boolean> =>
    Effect.gen(function*() {
      if (!isDomElement(node)) return false
      const event = new KeyboardEvent("keyup", {
        key,
        bubbles: true,
        cancelable: true,
        composed: true,
        shiftKey: modifiers?.shift ?? false,
        ctrlKey: modifiers?.ctrl ?? false,
        altKey: modifiers?.alt ?? false,
        metaKey: modifiers?.meta ?? false
      })
      node.dispatchEvent(event)
      yield* settle
      return event.defaultPrevented
    })

  return {
    kind: "dom",
    root: () => container,
    activeElement: () => doc.activeElement ?? undefined,
    click,
    focus,
    keydown,
    keyup
  }
}

export const resolveDriver = (
  target: A11yTarget,
  settleOverride?: Effect.Effect<void>
): Effect.Effect<A11yDriver> =>
  Effect.gen(function*() {
    if (isPlayTarget(target)) {
      const tracker = Option.getOrUndefined(
        yield* Effect.serviceOption(FocusTracker)
      )
      return makePlayDriver(target, tracker)
    }
    if (isDomTarget(target)) {
      return makeDomDriver(
        target.container,
        settleOverride ?? target.settle ?? defaultDomSettle
      )
    }
    return makeDomDriver(target, settleOverride ?? defaultDomSettle)
  })
