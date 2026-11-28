export interface FocusRecoveryInput<K extends string = string> {
  /** Visible focusable item keys in order before the update. */
  readonly previousOrder: ReadonlyArray<K>
  /** Visible focusable item keys in order after the update. */
  readonly nextOrder: ReadonlyArray<K>
  /** The item key that held focus before the update. */
  readonly lostKey: K | null | undefined
  /**
   * Optional parent lookup for hierarchical collections (such as `Tree`): when
   * a branch collapses while focus was on a descendant, walks up to the
   * nearest surviving ancestor before falling back to siblings.
   */
  readonly parentOf?: ((key: K) => K | undefined) | undefined
}

/**
 * Deterministic focus recovery for collections and trees.
 *
 * When the focused item leaves the visible order (row deleted, filtered out,
 * or tree branch collapsed), selects the surviving target in priority order:
 * 1. `lostKey` itself if still present in `nextOrder`.
 * 2. Nearest surviving ancestor via `parentOf` (for collapsed tree branches).
 * 3. Next surviving item after `lostKey`'s old position in `previousOrder`.
 * 4. Previous surviving item before `lostKey`'s old position in `previousOrder`.
 * 5. First item in `nextOrder`, or `undefined` when empty.
 */
export const recoverFocusKey = <K extends string>({
  lostKey,
  nextOrder,
  parentOf,
  previousOrder
}: FocusRecoveryInput<K>): K | undefined => {
  if (nextOrder.length === 0) return undefined
  const nextSet = new Set<K>(nextOrder)
  if (lostKey === null || lostKey === undefined) return nextOrder[0]
  if (nextSet.has(lostKey)) return lostKey

  // 1. Hierarchical ancestor recovery (e.g. collapsed tree branch)
  if (parentOf !== undefined) {
    const visited = new Set<K>([lostKey])
    let ancestor = parentOf(lostKey)
    while (ancestor !== undefined && !visited.has(ancestor)) {
      if (nextSet.has(ancestor)) return ancestor
      visited.add(ancestor)
      ancestor = parentOf(ancestor)
    }
  }

  // 2. Sibling recovery from previous position (next surviving, then previous surviving)
  const oldIdx = previousOrder.indexOf(lostKey)
  if (oldIdx !== -1) {
    for (let i = oldIdx + 1; i < previousOrder.length; i++) {
      const candidate = previousOrder[i]
      if (candidate !== undefined && nextSet.has(candidate)) return candidate
    }
    for (let i = oldIdx - 1; i >= 0; i--) {
      const candidate = previousOrder[i]
      if (candidate !== undefined && nextSet.has(candidate)) return candidate
    }
  }

  return nextOrder[0]
}
