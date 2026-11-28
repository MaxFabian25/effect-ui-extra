export interface TransferItem {
  readonly id: string
}

export interface TransferContainer<A extends TransferItem = TransferItem> {
  readonly id: string
  readonly items: ReadonlyArray<A>
  readonly maxItems?: number | undefined
}

export interface TransferLocation {
  readonly containerId: string
  readonly index: number
}

export interface TransferOptions<A extends TransferItem = TransferItem> {
  readonly accept?: (item: A, targetContainerId: string, sourceContainerId: string) => boolean
}

export interface TransferResult<A extends TransferItem = TransferItem> {
  readonly containers: ReadonlyArray<TransferContainer<A>>
  readonly moved: boolean
  readonly from: TransferLocation | null
  readonly to: TransferLocation | null
}

/** Finds an item's current container and index. */
export const findTransferItem = <A extends TransferItem>(
  containers: ReadonlyArray<TransferContainer<A>>,
  itemId: string
): { readonly item: A; readonly location: TransferLocation } | undefined => {
  for (const container of containers) {
    for (let idx = 0; idx < container.items.length; idx++) {
      const item = container.items[idx]
      if (item !== undefined && item.id === itemId) {
        return {
          item,
          location: { containerId: container.id, index: idx }
        }
      }
    }
  }
  return undefined
}

/**
 * Checks whether `itemId` can be transferred to `targetContainerId`, enforcing
 * container existence, `maxItems` capacity (when changing containers), and any
 * custom `accept` predicate.
 */
export const canTransferItem = <A extends TransferItem>(
  containers: ReadonlyArray<TransferContainer<A>>,
  itemId: string,
  targetContainerId: string,
  options?: TransferOptions<A>
): boolean => {
  const found = findTransferItem(containers, itemId)
  if (found === undefined) return false
  const target = containers.find((c) => c.id === targetContainerId)
  if (target === undefined) return false
  const sameContainer = found.location.containerId === targetContainerId
  if (!sameContainer && target.maxItems !== undefined && target.items.length >= target.maxItems) {
    return false
  }
  if (
    options?.accept !== undefined &&
    !options.accept(found.item, targetContainerId, found.location.containerId)
  ) {
    return false
  }
  return true
}

/**
 * Pure immutable cross-container drag-and-drop transfer (Kanban columns,
 * multi-list boards, and within-container reordering). Returns `moved: false`
 * with the original array reference when the transfer is invalid or a no-op.
 */
export const transferItem = <A extends TransferItem>(
  containers: ReadonlyArray<TransferContainer<A>>,
  itemId: string,
  target: TransferLocation,
  options?: TransferOptions<A>
): TransferResult<A> => {
  const found = findTransferItem(containers, itemId)
  if (found === undefined) {
    return { containers, moved: false, from: null, to: null }
  }
  if (!canTransferItem(containers, itemId, target.containerId, options)) {
    return { containers, moved: false, from: found.location, to: null }
  }

  const from = found.location
  const targetContainer = containers.find((c) => c.id === target.containerId)
  if (targetContainer === undefined) {
    return { containers, moved: false, from, to: null }
  }
  const sameContainer = from.containerId === target.containerId
  const maxIndex = sameContainer ? targetContainer.items.length - 1 : targetContainer.items.length
  const clampedIndex = Math.max(0, Math.min(maxIndex, Math.floor(target.index)))

  if (sameContainer && clampedIndex === from.index) {
    return { containers, moved: false, from, to: from }
  }

  const next = containers.map((container) => {
    if (sameContainer && container.id === from.containerId) {
      const copy = [...container.items]
      const [item] = copy.splice(from.index, 1)
      if (item !== undefined) {
        copy.splice(clampedIndex, 0, item)
      }
      return { ...container, items: copy }
    }
    if (container.id === from.containerId) {
      return {
        ...container,
        items: container.items.filter((item) => item.id !== itemId)
      }
    }
    if (container.id === target.containerId) {
      const copy = [...container.items]
      copy.splice(clampedIndex, 0, found.item)
      return { ...container, items: copy }
    }
    return container
  })

  return {
    containers: next,
    moved: true,
    from,
    to: { containerId: target.containerId, index: clampedIndex }
  }
}

export type TransferMoveKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"

/**
 * Keyboard transfer helper for accessible Kanban and multi-list boards:
 * `ArrowUp`/`ArrowDown` reorder within the current container, while
 * `ArrowLeft`/`ArrowRight` transfer to the previous/next accepting container
 * (respecting `dir: "rtl"`).
 */
export const moveTransferItemByKey = <A extends TransferItem>(
  containers: ReadonlyArray<TransferContainer<A>>,
  itemId: string,
  key: TransferMoveKey,
  options?: TransferOptions<A> & { readonly dir?: "ltr" | "rtl" | undefined }
): TransferResult<A> => {
  const found = findTransferItem(containers, itemId)
  if (found === undefined) {
    return { containers, moved: false, from: null, to: null }
  }
  const { containerId, index } = found.location
  const colIdx = containers.findIndex((c) => c.id === containerId)

  if (key === "ArrowUp") {
    return transferItem(containers, itemId, { containerId, index: index - 1 }, options)
  }
  if (key === "ArrowDown") {
    return transferItem(containers, itemId, { containerId, index: index + 1 }, options)
  }

  const isRtl = options?.dir === "rtl"
  const step = (key === "ArrowRight") !== isRtl ? 1 : -1
  for (let i = colIdx + step; i >= 0 && i < containers.length; i += step) {
    const candidate = containers[i]
    if (candidate === undefined) continue
    if (canTransferItem(containers, itemId, candidate.id, options)) {
      const clampedIdx = Math.min(index, candidate.items.length)
      return transferItem(
        containers,
        itemId,
        { containerId: candidate.id, index: clampedIdx },
        options
      )
    }
  }
  return { containers, moved: false, from: found.location, to: null }
}
