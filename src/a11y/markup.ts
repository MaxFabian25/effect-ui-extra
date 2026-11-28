import * as Effect from "effect/Effect"

export type MarkupViolationRule =
  | "duplicate-id"
  | "broken-aria-ref"
  | "broken-label-for"
  | "nested-interactive"

export interface MarkupViolation {
  readonly rule: MarkupViolationRule
  readonly message: string
  readonly tag?: string | undefined
  readonly id?: string | undefined
  readonly attr?: string | undefined
}

export class MarkupViolationError extends Error {
  readonly _tag = "MarkupViolationError"
  readonly violations: ReadonlyArray<MarkupViolation>
  constructor(violations: ReadonlyArray<MarkupViolation>) {
    super(
      `Markup audit failed with ${violations.length} violation(s):\n${violations
        .map((v) => `  - [${v.rule}] ${v.message}`)
        .join("\n")}`
    )
    this.name = "MarkupViolationError"
    this.violations = violations
  }
}

const VOID_TAGS: ReadonlySet<string> = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
])

const ARIA_IDREF_ATTRS: ReadonlyArray<string> = [
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-owns",
  "aria-activedescendant",
  "aria-errormessage",
  "aria-details",
  "aria-flowto"
]

const INTERACTIVE_PARENTS: ReadonlySet<string> = new Set(["button", "a"])
const INTERACTIVE_CHILDREN: ReadonlySet<string> = new Set([
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "summary"
])

const parseAttributes = (raw: string): ReadonlyMap<string, string> => {
  const attrs = new Map<string, string>()
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const rawName = m[1]
    if (rawName === undefined) continue
    const name = rawName.toLowerCase()
    const val = m[2] ?? m[3] ?? m[4] ?? ""
    attrs.set(name, val)
  }
  return attrs
}

/**
 * Audits rendered HTML markup for structural accessibility bugs:
 * duplicate `id` values, dangling ARIA IDREF attributes, broken `<label for>`,
 * and illegal nested interactive elements (`<button>` / `<a href>`).
 */
export const auditMarkup = (html: string): ReadonlyArray<MarkupViolation> => {
  const violations: Array<MarkupViolation> = []
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")

  const idCounts = new Map<string, number>()
  const ariaRefs: Array<{ readonly tag: string; readonly attr: string; readonly refId: string }> = []
  const labelFors: Array<{ readonly refId: string }> = []
  const openStack: Array<{ readonly tag: string; readonly interactive: boolean }> = []

  const tagRe = /<(\/)?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)(\/)?>/g
  let m: RegExpExecArray | null

  while ((m = tagRe.exec(cleaned)) !== null) {
    const isClose = m[1] === "/"
    const rawTag = m[2]
    if (rawTag === undefined) continue
    const tag = rawTag.toLowerCase()
    const rawAttrs = m[3] ?? ""
    const isSelfClose = m[4] === "/" || VOID_TAGS.has(tag)

    if (isClose) {
      for (let i = openStack.length - 1; i >= 0; i--) {
        if (openStack[i]?.tag === tag) {
          openStack.splice(i)
          break
        }
      }
      continue
    }

    const attrs = parseAttributes(rawAttrs)
    const id = attrs.get("id")?.trim()
    if (id !== undefined && id.length > 0) {
      const next = (idCounts.get(id) ?? 0) + 1
      idCounts.set(id, next)
      if (next === 2) {
        violations.push({
          rule: "duplicate-id",
          id,
          tag,
          message: `Duplicate id="${id}" found on <${tag}>.`
        })
      }
    }

    for (const attr of ARIA_IDREF_ATTRS) {
      const rawVal = attrs.get(attr)?.trim()
      if (rawVal === undefined || rawVal.length === 0) continue
      for (const token of rawVal.split(/\s+/)) {
        if (token.length > 0) {
          ariaRefs.push({ tag, attr, refId: token })
        }
      }
    }

    if (tag === "label") {
      const forVal = attrs.get("for")?.trim()
      if (forVal !== undefined && forVal.length > 0) {
        labelFors.push({ refId: forVal })
      }
    }

    const isInteractiveChild =
      INTERACTIVE_CHILDREN.has(tag) &&
      (tag !== "a" || attrs.has("href")) &&
      (tag !== "input" || attrs.get("type")?.toLowerCase() !== "hidden")

    if (isInteractiveChild) {
      const interactiveAncestor = openStack.find((entry) => entry.interactive)
      if (interactiveAncestor !== undefined) {
        violations.push({
          rule: "nested-interactive",
          tag,
          message: `Interactive <${tag}> is nested inside interactive <${interactiveAncestor.tag}>.`
        })
      }
    }

    if (!isSelfClose) {
      const isInteractiveParent =
        INTERACTIVE_PARENTS.has(tag) && (tag !== "a" || attrs.has("href"))
      openStack.push({ tag, interactive: isInteractiveParent })
    }
  }

  for (const ref of ariaRefs) {
    if (!idCounts.has(ref.refId)) {
      violations.push({
        rule: "broken-aria-ref",
        tag: ref.tag,
        attr: ref.attr,
        id: ref.refId,
        message: `<${ref.tag} ${ref.attr}="${ref.refId}"> references missing id="${ref.refId}".`
      })
    }
  }

  for (const lf of labelFors) {
    if (!idCounts.has(lf.refId)) {
      violations.push({
        rule: "broken-label-for",
        tag: "label",
        attr: "for",
        id: lf.refId,
        message: `<label for="${lf.refId}"> references missing id="${lf.refId}".`
      })
    }
  }

  return violations
}

/** Effect-returning assertion gate failing with `MarkupViolationError` when `auditMarkup` finds issues. */
export const checkMarkup = (html: string): Effect.Effect<void, MarkupViolationError> => {
  const violations = auditMarkup(html)
  return violations.length === 0
    ? Effect.void
    : Effect.fail(new MarkupViolationError(violations))
}
