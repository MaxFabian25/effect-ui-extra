import * as Effect from "effect/Effect"
import {
  allElements,
  describeNode,
  findById,
  getAttr,
  getName,
  getRole,
  getTag,
  isEffectivelyHidden
} from "./aria.js"
import { resolveDriver } from "./driver.js"
import type { A11yTarget, NodeLike } from "./types.js"

export const NAMABLE_ROLES: ReadonlySet<string> = new Set([
  "alertdialog",
  "button",
  "checkbox",
  "combobox",
  "dialog",
  "link",
  "listbox",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "radiogroup",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "tablist",
  "textbox",
  "tree",
  "treeitem"
])

export interface AccessibleNameViolation {
  readonly rule: "missing-accessible-name" | "aria-labelledby-ref" | "aria-labelledby-empty"
  readonly role: string
  readonly element: string
  readonly message: string
}

export class AccessibleNameError extends Error {
  readonly _tag = "AccessibleNameError"
  readonly violations: ReadonlyArray<AccessibleNameViolation>

  constructor(violations: ReadonlyArray<AccessibleNameViolation>) {
    const summary = violations
      .map((v) => `  - [${v.rule}] ${v.element}: ${v.message}`)
      .join("\n")
    super(`Accessible name check failed (${violations.length} violation(s)):\n${summary}`)
    this.name = "AccessibleNameError"
    this.violations = violations
  }
}

export interface CheckAccessibleNamesOptions {
  readonly roles?: ReadonlySet<string> | undefined
  readonly ignore?: ((node: NodeLike) => boolean) | undefined
}

const isInteractiveNativeControl = (node: NodeLike): boolean => {
  const tag = getTag(node)
  if (tag === "button" || tag === "select" || tag === "textarea") return true
  if (tag === "input") return (getAttr(node, "type") ?? "").toLowerCase() !== "hidden"
  if (tag === "a") return getAttr(node, "href") !== undefined
  return false
}

const auditRoot = (
  root: NodeLike,
  options: CheckAccessibleNamesOptions = {}
): ReadonlyArray<AccessibleNameViolation> => {
  const roles = options.roles ?? NAMABLE_ROLES
  const violations: Array<AccessibleNameViolation> = []

  for (const node of allElements(root)) {
    if (isEffectivelyHidden(root, node)) continue
    if (options.ignore !== undefined && options.ignore(node)) continue

    const role = getRole(root, node)
    const shouldCheck =
      (role !== undefined && roles.has(role)) || isInteractiveNativeControl(node)
    if (!shouldCheck) continue

    const roleLabel = role ?? getTag(node)
    const labelledBy = getAttr(node, "aria-labelledby")
    if (labelledBy !== undefined) {
      const ids = labelledBy.trim().split(/\s+/).filter((s) => s.length > 0)
      if (ids.length === 0) {
        violations.push({
          rule: "aria-labelledby-empty",
          role: roleLabel,
          element: describeNode(root, node),
          message: "aria-labelledby is present but empty."
        })
      } else {
        for (const id of ids) {
          if (findById(root, id) === undefined) {
            violations.push({
              rule: "aria-labelledby-ref",
              role: roleLabel,
              element: describeNode(root, node),
              message: `aria-labelledby references missing id "${id}".`
            })
          }
        }
      }
    }

    if (getName(root, node) === "") {
      violations.push({
        rule: "missing-accessible-name",
        role: roleLabel,
        element: describeNode(root, node),
        message: `Interactive ${roleLabel} has no accessible name (add visible text, aria-label, or aria-labelledby).`
      })
    }
  }

  return violations
}

/**
 * Audits every visible interactive control under `target` (`HtmlPlay` or DOM)
 * for missing accessible names or broken `aria-labelledby` references.
 */
export const auditAccessibleNames = (
  target: A11yTarget,
  options: CheckAccessibleNamesOptions = {}
): Effect.Effect<ReadonlyArray<AccessibleNameViolation>> =>
  Effect.gen(function*() {
    const driver = yield* resolveDriver(target)
    return auditRoot(driver.root(), options)
  })

/**
 * Fails with `AccessibleNameError` if any visible interactive control under
 * `target` lacks an accessible name or has a broken `aria-labelledby`.
 */
export const checkAccessibleNames = (
  target: A11yTarget,
  options: CheckAccessibleNamesOptions = {}
): Effect.Effect<void, AccessibleNameError> =>
  Effect.gen(function*() {
    const violations = yield* auditAccessibleNames(target, options)
    if (violations.length > 0) {
      return yield* Effect.fail(new AccessibleNameError(violations))
    }
  })
