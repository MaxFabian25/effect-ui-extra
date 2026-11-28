import { UiSchema } from '@effect/ui';
import type { View } from '@effect/ui';
import { Html, HtmlCommand } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { recoverFocusKey } from "./focusRecovery.js"
import { chevronRightIcon, resolveDir, safeIdToken } from "./internal.js"

export interface TreeNode {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean | undefined
  readonly children?: ReadonlyArray<TreeNode> | undefined
}

export const TreeNodeSchema: Schema.Codec<TreeNode> = Schema.Struct({
  value: Schema.String,
  label: Schema.String,
  disabled: Schema.optional(Schema.Boolean),
  children: Schema.optional(Schema.Array(Schema.suspend(() => TreeNodeSchema)))
})

export const TreeProps = Schema.Struct({
  label: Schema.String,
  nodes: Schema.Array(TreeNodeSchema),
  expanded: Schema.Array(Schema.String),
  selected: Schema.NullOr(Schema.String),
  dir: Schema.optional(Schema.Literals(["ltr", "rtl"])),
  idPrefix: Schema.optional(Schema.String)
})
export type TreeProps = typeof TreeProps.Type

export const TreeEvents = UiSchema.TaggedEnum({
  ToggledExpand: {
    value: Schema.String,
    expanded: Schema.Array(Schema.String)
  },
  Selected: { value: Schema.String }
})
export type TreeEvents = typeof TreeEvents.Type

const TreeMsg = UiSchema.TaggedEnum({
  FocusedNode: { value: Schema.String },
  MovedFocus: { value: Schema.String },
  ExpandedBranch: { value: Schema.String },
  CollapsedBranch: { value: Schema.String },
  ExpandedSiblings: { values: Schema.Array(Schema.String) },
  ActivatedNode: { value: Schema.String },
  ClickedBranch: { value: Schema.String, expanded: Schema.Boolean },
  FocusCommandDone: {}
})

interface FlatTreeItem {
  readonly node: TreeNode
  readonly parent: string | undefined
  readonly level: number
  readonly posInSet: number
  readonly setSize: number
  readonly hasChildren: boolean
  readonly siblingBranches: ReadonlyArray<string>
}

const treeItemRef = (value: string) => Html.ref(`TreeItem[${value}]`, "li")

const flattenVisible = (
  nodes: ReadonlyArray<TreeNode>,
  expandedSet: ReadonlySet<string>
): {
  readonly visible: ReadonlyArray<FlatTreeItem>
  readonly parentMap: ReadonlyMap<string, string | undefined>
} => {
  const visible: Array<FlatTreeItem> = []
  const parentMap = new Map<string, string | undefined>()

  const walkAllParents = (list: ReadonlyArray<TreeNode>, parent: string | undefined) => {
    for (const n of list) {
      parentMap.set(n.value, parent)
      if (n.children !== undefined && n.children.length > 0) {
        walkAllParents(n.children, n.value)
      }
    }
  }
  walkAllParents(nodes, undefined)

  const walkVisible = (
    list: ReadonlyArray<TreeNode>,
    parent: string | undefined,
    level: number
  ) => {
    const siblingBranches = list
      .filter((n) => n.children !== undefined && n.children.length > 0 && !n.disabled)
      .map((n) => n.value)
    for (let i = 0; i < list.length; i++) {
      const node = list[i]
      if (node === undefined) continue
      const hasChildren = node.children !== undefined && node.children.length > 0
      visible.push({
        node,
        parent,
        level,
        posInSet: i + 1,
        setSize: list.length,
        hasChildren,
        siblingBranches
      })
      if (hasChildren && expandedSet.has(node.value)) {
        walkVisible(node.children, node.value, level + 1)
      }
    }
  }
  walkVisible(nodes, undefined, 1)

  return { visible, parentMap }
}

const resolveActive = (
  nodes: ReadonlyArray<TreeNode>,
  expanded: ReadonlyArray<string>,
  focused: string | null,
  previousOrder: ReadonlyArray<string>
): {
  readonly active: string | null
  readonly visible: ReadonlyArray<FlatTreeItem>
  readonly visibleKeys: ReadonlyArray<string>
} => {
  const { parentMap, visible } = flattenVisible(nodes, new Set(expanded))
  const visibleKeys = visible
    .filter((f) => !f.node.disabled)
    .map((f) => f.node.value)
  const active =
    recoverFocusKey({
      previousOrder,
      nextOrder: visibleKeys,
      lostKey: focused,
      parentOf: (k) => parentMap.get(k)
    }) ?? null
  return { active, visible, visibleKeys }
}

/**
 * Accessible WAI-ARIA TreeView with roving tabindex, `HtmlCommand.focus`, full
 * APG keyboard navigation (`ArrowDown`/`ArrowUp`/`ArrowRight`/`ArrowLeft`/
 * `Home`/`End`/`Enter`/`Space`/`*`), and hierarchical `FocusRecovery` when a
 * focused branch collapses or a node is removed.
 */
export const Tree = Html.component({
  name: "Tree",
  props: TreeProps,
  model: Schema.Struct({
    focused: Schema.NullOr(Schema.String),
    lastOrder: Schema.Array(Schema.String)
  }),
  message: TreeMsg,
  events: TreeEvents
}).make({
  init: ($) => {
    const { active, visibleKeys } = resolveActive(
      $.props.nodes,
      $.props.expanded,
      null,
      []
    )
    return { focused: active, lastOrder: [...visibleKeys] }
  },
  update: {
    FocusedNode: ($, { value }) => {
      const { visibleKeys } = resolveActive(
        $.props.nodes,
        $.props.expanded,
        value,
        $.model.lastOrder
      )
      return $.evolve({ focused: value, lastOrder: [...visibleKeys] })
    },
    MovedFocus: ($, { value }) => {
      const { visibleKeys } = resolveActive(
        $.props.nodes,
        $.props.expanded,
        value,
        $.model.lastOrder
      )
      return $.evolve({ focused: value, lastOrder: [...visibleKeys] }).run(
        HtmlCommand.focus(treeItemRef(value), () => TreeMsg.FocusCommandDone())
      )
    },
    ExpandedBranch: ($, { value }) => {
      const nextExpanded = $.props.expanded.includes(value)
        ? [...$.props.expanded]
        : [...$.props.expanded, value]
      return $.emit(
        TreeEvents.ToggledExpand({ value, expanded: nextExpanded })
      )
    },
    CollapsedBranch: ($, { value }) => {
      const nextExpanded = $.props.expanded.filter((v) => v !== value)
      const { active, visibleKeys } = resolveActive(
        $.props.nodes,
        nextExpanded,
        $.model.focused,
        $.model.lastOrder
      )
      const base = $.evolve({
        focused: active,
        lastOrder: [...visibleKeys]
      }).emit(TreeEvents.ToggledExpand({ value, expanded: nextExpanded }))
      return active !== null && active !== $.model.focused
        ? base.run(
            HtmlCommand.focus(treeItemRef(active), () => TreeMsg.FocusCommandDone())
          )
        : base
    },
    ExpandedSiblings: ($, { values }) => {
      const merged = Array.from(new Set([...$.props.expanded, ...values]))
      const first = values[0]
      if (first === undefined) return $.model
      return $.emit(TreeEvents.ToggledExpand({ value: first, expanded: merged }))
    },
    ActivatedNode: ($, { value }) =>
      $.emit(TreeEvents.Selected({ value })),
    ClickedBranch: ($, { expanded, value }) => {
      const nextExpanded = expanded
        ? $.props.expanded.filter((v) => v !== value)
        : $.props.expanded.includes(value)
        ? [...$.props.expanded]
        : [...$.props.expanded, value]
      return $.emit(TreeEvents.Selected({ value })).emit(
        TreeEvents.ToggledExpand({ value, expanded: nextExpanded })
      )
    },
    FocusCommandDone: ($) => $.model
  },
  view: (h, model) => {
    const p = h.props
    const prefix = p.idPrefix ?? "tree"
    const expandedSet = new Set(p.expanded)
    const { parentMap } = flattenVisible(p.nodes, expandedSet)
    const { active, visible, visibleKeys } = resolveActive(
      p.nodes,
      p.expanded,
      model.focused,
      model.lastOrder
    )
    const metaByValue = new Map(visible.map((f) => [f.node.value, f]))
    const visibleKeySet = new Set(visibleKeys)

    const nearestEnabledAncestor = (start: string | undefined): string | undefined => {
      let cur = start
      while (cur !== undefined) {
        if (visibleKeySet.has(cur)) return cur
        cur = parentMap.get(cur)
      }
      return undefined
    }

    const renderList = (
      list: ReadonlyArray<TreeNode>
    ): ReadonlyArray<View.Content<typeof TreeMsg.Type>> =>
      list.flatMap((node) => {
        const meta = metaByValue.get(node.value)
        if (meta === undefined) return []
        const isBranch = meta.hasChildren
        const isExpanded = isBranch && expandedSet.has(node.value)
        const isSelected = p.selected === node.value
        const isStop = !node.disabled && active === node.value

        const safeVal = safeIdToken(node.value)
        const labelId = `${prefix}-label-${safeVal}`

        return h.li
          .key(node.value)
          .ref(treeItemRef(node.value))
          .attrs({
            id: `${prefix}-item-${safeVal}`,
            role: "treeitem",
            "aria-labelledby": labelId,
            tabindex: node.disabled ? "-1" : isStop ? "0" : "-1",
            "aria-level": String(meta.level),
            "aria-posinset": String(meta.posInSet),
            "aria-setsize": String(meta.setSize),
            "aria-selected": String(isSelected),
            ...(isBranch ? { "aria-expanded": String(isExpanded) } : {}),
            ...(node.disabled
              ? { "aria-disabled": "true", "data-disabled": "" }
              : {})
          })
          .on("focus", () =>
            node.disabled ? undefined : TreeMsg.FocusedNode({ value: node.value })
          )
          .on("click", () => {
            if (node.disabled) return undefined
            return isBranch
              ? TreeMsg.ClickedBranch({ value: node.value, expanded: isExpanded })
              : TreeMsg.ActivatedNode({ value: node.value })
          })
          .on(
            "keydown",
            ({ key }) => {
              if (node.disabled) return undefined
              const idx = visibleKeys.indexOf(node.value)
              const firstKey = visibleKeys[0]
              const lastKey = visibleKeys[visibleKeys.length - 1]
              if (key === "ArrowDown" && idx !== -1) {
                const next = visibleKeys[Math.min(visibleKeys.length - 1, idx + 1)]
                if (next !== undefined) return TreeMsg.MovedFocus({ value: next })
              }
              if (key === "ArrowUp" && idx !== -1) {
                const prev = visibleKeys[Math.max(0, idx - 1)]
                if (prev !== undefined) return TreeMsg.MovedFocus({ value: prev })
              }
              if (key === "Home" && firstKey !== undefined) {
                return TreeMsg.MovedFocus({ value: firstKey })
              }
              if (key === "End" && lastKey !== undefined) {
                return TreeMsg.MovedFocus({
                  value: lastKey
                })
              }
              const isRtl = resolveDir(p.dir) === "rtl"
              const expandKey = isRtl ? "ArrowLeft" : "ArrowRight"
              const collapseKey = isRtl ? "ArrowRight" : "ArrowLeft"
              if (key === expandKey) {
                if (isBranch && !isExpanded) {
                  return TreeMsg.ExpandedBranch({ value: node.value })
                }
                if (isBranch && isExpanded && node.children !== undefined) {
                  const firstEnabledChild = node.children.find((c) => !c.disabled)
                  if (firstEnabledChild !== undefined) {
                    return TreeMsg.MovedFocus({ value: firstEnabledChild.value })
                  }
                }
                return undefined
              }
              if (key === collapseKey) {
                if (isBranch && isExpanded) {
                  return TreeMsg.CollapsedBranch({ value: node.value })
                }
                const targetParent = nearestEnabledAncestor(meta.parent)
                if (targetParent !== undefined) {
                  return TreeMsg.MovedFocus({ value: targetParent })
                }
                return undefined
              }
              if (key === "Enter" || key === " ") {
                return TreeMsg.ActivatedNode({ value: node.value })
              }
              if (key === "*" && meta.siblingBranches.length > 0) {
                return TreeMsg.ExpandedSiblings({
                  values: [...meta.siblingBranches]
                })
              }
              return undefined
            },
            { preventDefault: true }
          )
          .children(
            h.span
              .attrs({ id: labelId })
              .children(
                isBranch ? chevronRightIcon(h) : undefined,
                node.label
              ),
            isExpanded && node.children !== undefined
              ? h.ul.attrs({ role: "group" }).children(...renderList(node.children))
              : undefined
          )
      })

    return h.ul
      .attrs({
        role: "tree",
        "aria-label": p.label,
        ...(p.dir !== undefined ? { dir: p.dir } : {})
      })
      .children(...renderList(p.nodes))
  }
})
