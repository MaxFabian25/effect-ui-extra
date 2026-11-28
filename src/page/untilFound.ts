export interface PanelHiddenOptions {
  /** Whether the panel is currently open. */
  readonly open: boolean
  /** Whether closed content should remain findable by browser Ctrl+F (`hidden="until-found"`). Defaults to `false`. */
  readonly findable?: boolean | undefined
  /** Override capability detection (useful in SSR/tests). */
  readonly untilFoundSupported?: boolean | undefined
}

/**
 * Returns `true` when the runtime DOM supports `hidden="until-found"` and the
 * `beforematch` event (Chrome/Edge 102+, Firefox 148+). Safe before `<body>`
 * parses and in SSR (`false`).
 */
export const supportsHiddenUntilFound = (): boolean =>
  typeof HTMLElement !== "undefined" &&
  "onbeforematch" in HTMLElement.prototype

/**
 * Computes the `hidden` attribute value for collapsible, accordion, or tab
 * panels:
 * - `undefined` when open
 * - `"until-found"` when closed, `findable: true`, and supported
 * - `""` (boolean hidden) otherwise
 */
export const panelHiddenAttr = (
  options: PanelHiddenOptions
): "" | "until-found" | undefined => {
  if (options.open) return undefined
  const supported = options.untilFoundSupported ?? supportsHiddenUntilFound()
  return options.findable && supported ? "until-found" : ""
}

export interface FindableStandInGroup<T> {
  readonly groupIndex: number
  readonly startIndex: number
  readonly items: ReadonlyArray<T>
}

/**
 * Chunks unrendered virtualized rows into `hidden="until-found"` stand-in
 * groups (default `100` rows per group) so the browser skips style/layout for
 * offscreen groups while keeping every row searchable by Ctrl+F.
 */
export const chunkFindableRows = <T>(
  rows: ReadonlyArray<T>,
  groupSize = 100
): ReadonlyArray<FindableStandInGroup<T>> => {
  const size = Math.max(1, Math.floor(groupSize))
  const groups: Array<FindableStandInGroup<T>> = []
  for (let start = 0; start < rows.length; start += size) {
    groups.push({
      groupIndex: groups.length,
      startIndex: start,
      items: rows.slice(start, start + size)
    })
  }
  return groups
}

/**
 * Attaches a `beforematch` listener to a DOM element so browser Ctrl+F reveals
 * a `hidden="until-found"` panel cleanly. Returns a cleanup function.
 */
export const bindBeforeMatch = (
  element: EventTarget,
  onReveal: (event: Event) => void
): (() => void) => {
  const listener = (event: Event) => {
    onReveal(event)
  }
  element.addEventListener("beforematch", listener)
  return () => {
    element.removeEventListener("beforematch", listener)
  }
}
