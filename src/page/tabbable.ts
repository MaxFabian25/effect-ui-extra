const TABBABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "details > summary:first-of-type",
  "[tabindex]"
].join(",")

const FORM_CONTROL_TAGS = new Set(["button", "input", "select", "textarea"])

const isDisabledByFieldset = (el: HTMLElement): boolean => {
  if (!FORM_CONTROL_TAGS.has(el.tagName.toLowerCase())) return false
  let cur: HTMLElement | null = el.parentElement
  while (cur !== null) {
    if (cur.tagName.toLowerCase() === "fieldset" && cur.hasAttribute("disabled")) {
      const firstLegend = Array.from(cur.children).find(
        (child) => child.tagName.toLowerCase() === "legend"
      )
      if (firstLegend === undefined || !firstLegend.contains(el)) {
        return true
      }
    }
    cur = cur.parentElement
  }
  return false
}

const isHiddenOrInert = (el: HTMLElement): boolean => {
  const view = el.ownerDocument?.defaultView
  let prev: HTMLElement | null = null
  let cur: HTMLElement | null = el
  while (cur !== null) {
    if (cur.hasAttribute("hidden") || cur.hasAttribute("inert")) return true
    const style = cur.style
    if (
      style &&
      (style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse")
    ) {
      return true
    }
    if (view !== null && view !== undefined && typeof view.getComputedStyle === "function") {
      const computed = view.getComputedStyle(cur)
      if (
        computed.display === "none" ||
        computed.visibility === "hidden" ||
        computed.visibility === "collapse"
      ) {
        return true
      }
    }
    if (
      prev !== null &&
      cur.tagName.toLowerCase() === "details" &&
      !cur.hasAttribute("open")
    ) {
      const firstSummary = Array.from(cur.children).find(
        (child) => child.tagName.toLowerCase() === "summary"
      )
      if (firstSummary === undefined || (prev !== firstSummary && !firstSummary.contains(el))) {
        return true
      }
    }
    prev = cur
    cur = cur.parentElement
  }
  return false
}

/** Returns `true` when `el` is keyboard-reachable via Tab in its current DOM state. */
export const isTabbable = (el: HTMLElement): boolean => {
  if (isHiddenOrInert(el)) return false
  if ((el as HTMLButtonElement).disabled === true || isDisabledByFieldset(el)) return false
  const tabIndexAttr = el.getAttribute("tabindex")
  if (tabIndexAttr !== null) {
    const parsed = Number.parseInt(tabIndexAttr, 10)
    if (Number.isNaN(parsed) || parsed < 0) return false
    return true
  }
  const tag = el.tagName.toLowerCase()
  if (tag === "a" || tag === "area") return el.hasAttribute("href")
  if (tag === "input") return (el as HTMLInputElement).type !== "hidden"
  if (tag === "button" || tag === "select" || tag === "textarea" || tag === "iframe") return true
  if (tag === "summary") return el.parentElement?.tagName.toLowerCase() === "details"
  return el.getAttribute("contenteditable") !== null && el.getAttribute("contenteditable") !== "false"
}

/**
 * Returns every tabbable element inside `root` in W3C Tab order (positive
 * `tabindex` ascending first, then DOM order for `tabindex="0"` and native
 * tabbable elements).
 */
export const getTabbables = (root: ParentNode): ReadonlyArray<HTMLElement> => {
  const candidates = Array.from(root.querySelectorAll(TABBABLE_SELECTOR)) as Array<HTMLElement>
  const valid = candidates.filter(isTabbable)
  const positive: Array<{ readonly el: HTMLElement; readonly idx: number; readonly order: number }> = []
  const regular: Array<HTMLElement> = []

  valid.forEach((el, order) => {
    const raw = el.getAttribute("tabindex")
    const parsed = raw !== null ? Number.parseInt(raw, 10) : 0
    if (!Number.isNaN(parsed) && parsed > 0) {
      positive.push({ el, idx: parsed, order })
    } else {
      regular.push(el)
    }
  })

  positive.sort((a, b) => (a.idx !== b.idx ? a.idx - b.idx : a.order - b.order))
  return [...positive.map((p) => p.el), ...regular]
}

/** Finds the next or previous tabbable element relative to `current` inside `root`. */
export const findNextTabbable = (
  root: ParentNode,
  current: HTMLElement | null,
  direction: "next" | "prev" = "next",
  options?: { readonly wrap?: boolean | undefined }
): HTMLElement | null => {
  const list = getTabbables(root)
  if (list.length === 0) return null
  if (current === null) return direction === "next" ? list[0]! : list[list.length - 1]!
  const idx = list.indexOf(current)
  if (idx === -1) return direction === "next" ? list[0]! : list[list.length - 1]!
  const delta = direction === "next" ? 1 : -1
  const rawNext = idx + delta
  if (rawNext >= 0 && rawNext < list.length) return list[rawNext]!
  if (options?.wrap === true) {
    return list[(rawNext + list.length) % list.length]!
  }
  return null
}

/**
 * Runs a DOM mutation while preserving focus on an element identified by
 * `resolveTarget` (for list/tree reorders where frameworks move DOM nodes and
 * browsers drop `document.activeElement`).
 */
export const preserveFocusAcrossUpdate = (
  doc: Document,
  mutate: () => void,
  resolveTarget?: () => HTMLElement | null
): boolean => {
  const prev = doc.activeElement as HTMLElement | null
  mutate()
  const target = resolveTarget !== undefined ? resolveTarget() : prev
  if (target !== null && doc.contains(target) && doc.activeElement !== target) {
    target.focus({ preventScroll: true })
    return true
  }
  return false
}
