import type { TreeNode } from "./tree.js"

export type TreeCheckState = boolean | "mixed"
export type TreeCheckStrategy = "all" | "leaves" | "parents"

const collectDescendantLeaves = (
  node: TreeNode,
  out: Array<string>
): void => {
  if (node.disabled) return
  if (node.children === undefined || node.children.length === 0) {
    out.push(node.value)
    return
  }
  for (const child of node.children) {
    collectDescendantLeaves(child, out)
  }
}

const findNode = (
  nodes: ReadonlyArray<TreeNode>,
  value: string
): TreeNode | undefined => {
  for (const node of nodes) {
    if (node.value === value) return node
    if (node.children !== undefined) {
      const found = findNode(node.children, value)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/**
 * Computes tri-state (`true`, `false`, or `"mixed"`) check states for every
 * node in `nodes` given the set of checked leaf values.
 */
export const computeTreeCheckStates = (
  nodes: ReadonlyArray<TreeNode>,
  checkedLeaves: ReadonlySet<string>
): ReadonlyMap<string, TreeCheckState> => {
  const states = new Map<string, TreeCheckState>()

  const visit = (node: TreeNode): TreeCheckState => {
    if (node.children === undefined || node.children.length === 0) {
      const s = checkedLeaves.has(node.value)
      states.set(node.value, s)
      return s
    }
    const enabledChildren = node.children.filter((c) => !c.disabled)
    const childStates = enabledChildren.map((c) => visit(c))
    for (const disabledChild of node.children.filter((c) => c.disabled)) {
      visit(disabledChild)
    }
    if (childStates.length === 0) {
      const s = checkedLeaves.has(node.value)
      states.set(node.value, s)
      return s
    }
    const allTrue = childStates.every((s) => s === true)
    const allFalse = childStates.every((s) => s === false)
    const state: TreeCheckState = allTrue ? true : allFalse ? false : "mixed"
    states.set(node.value, state)
    return state
  }

  for (const root of nodes) visit(root)
  return states
}

/**
 * Toggles a leaf or branch node, cascading down to all enabled descendant
 * leaves. Toggling a `"mixed"` or unchecked branch checks all its leaves;
 * toggling a fully checked branch unchecks all its leaves.
 */
export const toggleTreeNodeCheck = (
  nodes: ReadonlyArray<TreeNode>,
  checkedLeaves: ReadonlySet<string>,
  targetValue: string
): ReadonlySet<string> => {
  const target = findNode(nodes, targetValue)
  if (target === undefined || target.disabled) return new Set(checkedLeaves)

  const states = computeTreeCheckStates(nodes, checkedLeaves)
  const shouldCheck = states.get(targetValue) !== true
  const leaves: Array<string> = []
  collectDescendantLeaves(target, leaves)

  const next = new Set(checkedLeaves)
  for (const leaf of leaves) {
    if (shouldCheck) next.add(leaf)
    else next.delete(leaf)
  }
  return next
}

/**
 * Extracts checked node values according to the requested reporting strategy:
 * - `"leaves"`: only checked leaf ids
 * - `"parents"`: highest fully-checked ancestor ids (collapsing full subtrees)
 * - `"all"`: every fully-checked node id (parents and leaves)
 */
export const getCheckedByStrategy = (
  nodes: ReadonlyArray<TreeNode>,
  checkedLeaves: ReadonlySet<string>,
  strategy: TreeCheckStrategy = "leaves"
): ReadonlyArray<string> => {
  const states = computeTreeCheckStates(nodes, checkedLeaves)
  const out: Array<string> = []

  const walk = (list: ReadonlyArray<TreeNode>) => {
    for (const node of list) {
      const s = states.get(node.value)
      const isLeaf = node.children === undefined || node.children.length === 0
      if (strategy === "leaves") {
        if (isLeaf && s === true) out.push(node.value)
        else if (!isLeaf) walk(node.children!)
      } else if (strategy === "parents") {
        if (s === true) out.push(node.value)
        else if (!isLeaf) walk(node.children!)
      } else {
        if (s === true) out.push(node.value)
        if (!isLeaf) walk(node.children!)
      }
    }
  }

  walk(nodes)
  return out
}
