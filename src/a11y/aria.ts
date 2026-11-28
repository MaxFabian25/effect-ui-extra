import { HtmlLocator } from "@effect/ui/html/testing"
import type { TestHost } from "@effect/ui/testing"
import * as Predicate from "effect/Predicate"
import type { ApgPattern, NodeLike, PatternViolation } from "./types.js"

export const isDomElement = (node: unknown): node is globalThis.Element =>
  typeof node === "object" &&
  node !== null &&
  "nodeType" in node &&
  node.nodeType === 1

export const isTestElement = (
  node: unknown
): node is TestHost.TestElement =>
  Predicate.isTagged(node, "Element")

export const getTag = (node: NodeLike): string =>
  isDomElement(node) ? node.localName.toLowerCase() : node.tag.toLowerCase()

export const getAttr = (node: NodeLike, name: string): string | undefined =>
  isDomElement(node)
    ? (node.getAttribute(name) ?? undefined)
    : node.attrs[name]

export const getProp = (node: NodeLike, name: string): unknown =>
  isDomElement(node)
    ? Reflect.get(node, name)
    : node.props[name]

export const getChildren = (node: NodeLike): ReadonlyArray<NodeLike> => {
  if (isDomElement(node)) {
    return Array.from(node.children)
  }
  const out: Array<NodeLike> = []
  for (const child of node.children) {
    if (isTestElement(child)) out.push(child)
  }
  return out
}

export const getParent = (node: NodeLike): NodeLike | undefined =>
  isDomElement(node)
    ? (node.parentElement ?? undefined)
    : node.parent

export const allElements = (root: NodeLike): ReadonlyArray<NodeLike> => {
  const out: Array<NodeLike> = []
  const walk = (node: NodeLike) => {
    out.push(node)
    for (const child of getChildren(node)) walk(child)
  }
  walk(root)
  return out
}

export const containsNode = (root: NodeLike, target: NodeLike): boolean => {
  if (isDomElement(root) && isDomElement(target)) {
    return root.contains(target)
  }
  for (let at: NodeLike | undefined = target; at !== undefined; at = getParent(at)) {
    if (at === root) return true
  }
  return false
}

export const getRole = (root: NodeLike, node: NodeLike): string | undefined => {
  if (isDomElement(root) && isDomElement(node)) {
    return HtmlLocator.roleOf(root, node)
  }
  if (isTestElement(root) && isTestElement(node)) {
    return HtmlLocator.roleOf(root, node)
  }
  return undefined
}

export const getName = (root: NodeLike, node: NodeLike): string => {
  if (isDomElement(root) && isDomElement(node)) {
    return HtmlLocator.nameOf(root, node).trim()
  }
  if (isTestElement(root) && isTestElement(node)) {
    return HtmlLocator.nameOf(root, node).trim()
  }
  return ""
}

export const queryAllByRole = (
  root: NodeLike,
  role: string,
  options?: HtmlLocator.RoleOptions
): ReadonlyArray<NodeLike> => {
  if (isDomElement(root)) {
    return HtmlLocator.queryAllByRole(root, role, options)
  }
  return HtmlLocator.queryAllByRole(root, role, options).filter(isTestElement)
}

const isPopoverHidden = (node: NodeLike): boolean => {
  if (getAttr(node, "popover") === undefined) return false
  const prop = getProp(node, "popoverOpen")
  if (prop !== undefined) return prop !== true
  if (isDomElement(node)) {
    try {
      return !node.matches(":popover-open")
    } catch {
      return false
    }
  }
  return false
}

const isClosedDialog = (node: NodeLike): boolean => {
  if (getTag(node) !== "dialog") return false
  if (getAttr(node, "popover") !== undefined) {
    return isPopoverHidden(node)
  }
  const openProp = getProp(node, "open")
  if (openProp !== undefined) return openProp !== true && openProp !== "modal"
  return getAttr(node, "open") === undefined
}

export const isNodeHidden = (node: NodeLike): boolean =>
  getAttr(node, "hidden") !== undefined ||
  getAttr(node, "aria-hidden") === "true" ||
  getAttr(node, "inert") !== undefined ||
  (getTag(node) === "input" && (getAttr(node, "type") ?? "").toLowerCase() === "hidden") ||
  isClosedDialog(node) ||
  isPopoverHidden(node)

export const isEffectivelyHidden = (root: NodeLike, node: NodeLike): boolean => {
  for (let at: NodeLike | undefined = node; at !== undefined; at = getParent(at)) {
    if (isNodeHidden(at)) return true
    if (at === root) break
  }
  return false
}

export const isHardDisabled = (node: NodeLike): boolean =>
  getAttr(node, "disabled") !== undefined

export const isAriaDisabled = (node: NodeLike): boolean =>
  getAttr(node, "aria-disabled") === "true"

export const isDisabled = (node: NodeLike): boolean =>
  isHardDisabled(node) || isAriaDisabled(node)

const isNaturallyFocusable = (node: NodeLike): boolean => {
  const tag = getTag(node)
  if (tag === "button" || tag === "select" || tag === "textarea") {
    return !isHardDisabled(node)
  }
  if (tag === "input") {
    return !isHardDisabled(node) && (getAttr(node, "type") ?? "").toLowerCase() !== "hidden"
  }
  if (tag === "a" || tag === "area") {
    return getAttr(node, "href") !== undefined
  }
  if (tag === "summary") return true
  const editable = getAttr(node, "contenteditable")
  return editable !== undefined && editable.toLowerCase() !== "false"
}

export const getTabIndex = (node: NodeLike): number | undefined => {
  const raw = getAttr(node, "tabindex")
  if (raw === undefined) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

export const isFocusable = (node: NodeLike): boolean => {
  if (isHardDisabled(node)) return false
  if (getTabIndex(node) !== undefined) return true
  return isNaturallyFocusable(node)
}

export const isTabStop = (node: NodeLike): boolean => {
  if (isHardDisabled(node)) return false
  const ti = getTabIndex(node)
  if (ti !== undefined) return ti >= 0
  return isNaturallyFocusable(node)
}

export const findById = (root: NodeLike, id: string): NodeLike | undefined => {
  for (const el of allElements(root)) {
    if (getAttr(el, "id") === id) return el
  }
  if (isDomElement(root) && root.ownerDocument !== null) {
    const found = root.ownerDocument.getElementById(id)
    if (found !== null) return found
  }
  return undefined
}

export const describeNode = (root: NodeLike, node: NodeLike): string => {
  const tag = getTag(node)
  const id = getAttr(node, "id")
  const role = getRole(root, node)
  const name = getName(root, node)
  const parts: Array<string> = [`<${tag}`]
  if (id !== undefined && id !== "") parts.push(`id="${id}"`)
  if (role !== undefined) parts.push(`role="${role}"`)
  if (name !== "") parts.push(`name="${name}"`)
  return `${parts.join(" ")}>`
}

export const validateIdRefs = (
  root: NodeLike,
  node: NodeLike,
  attrName: "aria-labelledby" | "aria-describedby" | "aria-controls" | "aria-owns" | "aria-activedescendant",
  pattern: ApgPattern,
  apg: string
): ReadonlyArray<PatternViolation> => {
  const raw = getAttr(node, attrName)
  if (raw === undefined) return []
  const ids = raw.trim().split(/\s+/).filter((s) => s.length > 0)
  if (ids.length === 0) {
    return [{
      pattern,
      rule: `${attrName}-empty`,
      apg,
      element: describeNode(root, node),
      message: `${attrName} is present but empty.`
    }]
  }
  const violations: Array<PatternViolation> = []
  for (const id of ids) {
    if (findById(root, id) === undefined) {
      violations.push({
        pattern,
        rule: `${attrName}-ref`,
        apg,
        element: describeNode(root, node),
        message: `${attrName} references missing id "${id}".`
      })
    }
  }
  return violations
}

export const checkAccessibleName = (
  root: NodeLike,
  node: NodeLike,
  pattern: ApgPattern,
  rule: string,
  apg: string
): ReadonlyArray<PatternViolation> => {
  const violations: Array<PatternViolation> = [
    ...validateIdRefs(root, node, "aria-labelledby", pattern, apg)
  ]
  if (getName(root, node) === "") {
    violations.push({
      pattern,
      rule,
      apg,
      element: describeNode(root, node),
      message: "Element has no accessible name."
    })
  }
  return violations
}

export const checkRovingTabindex = (
  root: NodeLike,
  items: ReadonlyArray<NodeLike>,
  pattern: ApgPattern,
  apg: string,
  itemLabel: string
): ReadonlyArray<PatternViolation> => {
  const focusableItems = items.filter((item) => !isHardDisabled(item))
  if (focusableItems.length === 0) return []
  const violations: Array<PatternViolation> = []
  const stops = focusableItems.filter((item) => isTabStop(item))
  if (stops.length !== 1) {
    violations.push({
      pattern,
      rule: "roving-tabindex-count",
      apg,
      element: describeNode(root, root),
      message: `Expected exactly 1 tabbable ${itemLabel} (tabindex="0"), found ${stops.length} among ${focusableItems.length} focusable items.`
    })
  }
  for (const item of focusableItems) {
    if (!stops.includes(item) && getTabIndex(item) !== -1) {
      violations.push({
        pattern,
        rule: "roving-tabindex-inactive",
        apg,
        element: describeNode(root, item),
        message: `Inactive ${itemLabel} should have tabindex="-1", found ${
          getAttr(item, "tabindex") ?? "(none)"
        }.`
      })
    }
  }
  return violations
}

export const isBooleanAttr = (value: string | undefined): value is "true" | "false" =>
  value === "true" || value === "false"

export const isTriStateAttr = (
  value: string | undefined
): value is "true" | "false" | "mixed" =>
  value === "true" || value === "false" || value === "mixed"
