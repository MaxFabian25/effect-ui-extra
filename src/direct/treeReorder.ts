export interface ReorderTreeNode<A = unknown> {
  readonly id: string
  readonly children?: ReadonlyArray<ReorderTreeNode<A>> | undefined
  readonly data?: A | undefined
}

export type DropPlacement = "before" | "inside" | "after"

const containsId = <A>(
  node: ReorderTreeNode<A>,
  targetId: string
): boolean => {
  if (node.id === targetId) return true
  if (node.children === undefined) return false
  return node.children.some((c) => containsId(c, targetId))
}

const findNode = <A>(
  nodes: ReadonlyArray<ReorderTreeNode<A>>,
  id: string
): ReorderTreeNode<A> | undefined => {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children !== undefined) {
      const found = findNode(n.children, id)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/**
 * Validates whether dragging `dragId` onto `targetId` is structurally valid
 * (both nodes exist, `dragId !== targetId`, and `targetId` is not a descendant
 * of `dragId` which would create a cycle).
 */
export const canMoveTreeNode = <A>(
  nodes: ReadonlyArray<ReorderTreeNode<A>>,
  dragId: string,
  targetId: string
): boolean => {
  if (dragId === targetId) return false
  const dragged = findNode(nodes, dragId)
  if (dragged === undefined) return false
  if (findNode(nodes, targetId) === undefined) return false
  return !containsId(dragged, targetId)
}

const removeNode = <A>(
  nodes: ReadonlyArray<ReorderTreeNode<A>>,
  id: string
): {
  readonly next: ReadonlyArray<ReorderTreeNode<A>>
  readonly removed: ReorderTreeNode<A> | undefined
} => {
  let removed: ReorderTreeNode<A> | undefined
  const out: Array<ReorderTreeNode<A>> = []
  for (const n of nodes) {
    if (n.id === id) {
      removed = n
      continue
    }
    if (n.children !== undefined) {
      const res = removeNode(n.children, id)
      if (res.removed !== undefined) {
        removed = res.removed
        out.push({ ...n, children: res.next })
        continue
      }
    }
    out.push(n)
  }
  return { next: out, removed }
}

const insertNode = <A>(
  nodes: ReadonlyArray<ReorderTreeNode<A>>,
  targetId: string,
  placement: DropPlacement,
  nodeToInsert: ReorderTreeNode<A>
): { readonly next: ReadonlyArray<ReorderTreeNode<A>>; readonly inserted: boolean } => {
  let inserted = false
  const out: Array<ReorderTreeNode<A>> = []
  for (const n of nodes) {
    if (n.id === targetId) {
      inserted = true
      if (placement === "before") {
        out.push(nodeToInsert, n)
      } else if (placement === "after") {
        out.push(n, nodeToInsert)
      } else {
        out.push({
          ...n,
          children: [...(n.children ?? []), nodeToInsert]
        })
      }
      continue
    }
    if (n.children !== undefined && !inserted) {
      const res = insertNode(n.children, targetId, placement, nodeToInsert)
      if (res.inserted) {
        inserted = true
        out.push({ ...n, children: res.next })
        continue
      }
    }
    out.push(n)
  }
  return { next: out, inserted }
}

/**
 * Pure immutable hierarchical tree reorder supporting `"before"`, `"inside"`,
 * and `"after"` drop placements. Returns the original tree unchanged if the
 * move would create a cycle or references a missing node.
 */
export const moveTreeNode = <A>(
  nodes: ReadonlyArray<ReorderTreeNode<A>>,
  dragId: string,
  targetId: string,
  placement: DropPlacement
): ReadonlyArray<ReorderTreeNode<A>> => {
  if (!canMoveTreeNode(nodes, dragId, targetId)) return nodes
  const { next: stripped, removed } = removeNode(nodes, dragId)
  if (removed === undefined) return nodes
  const { inserted, next } = insertNode(stripped, targetId, placement, removed)
  return inserted ? next : nodes
}
