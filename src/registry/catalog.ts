import { AI_AND_BLOCK_REGISTRY_ITEMS } from "./items/aiAndBlocks.js"
import { APP_REGISTRY_ITEMS } from "./items/app.js"
import { CORE_REGISTRY_ITEMS } from "./items/core.js"
import type { RegistryCategory, RegistryItem } from "./schema.js"

export const REGISTRY_ITEMS: ReadonlyArray<RegistryItem> = [
  ...CORE_REGISTRY_ITEMS,
  ...APP_REGISTRY_ITEMS,
  ...AI_AND_BLOCK_REGISTRY_ITEMS
]

const BY_NAME: ReadonlyMap<string, RegistryItem> = new Map(
  REGISTRY_ITEMS.map((item) => [item.name, item])
)

export const getRegistryItem = (name: string): RegistryItem | undefined =>
  BY_NAME.get(name)

export const listRegistryItems = (filter?: {
  readonly category?: RegistryCategory | undefined
  readonly search?: string | undefined
}): ReadonlyArray<RegistryItem> => {
  const q = filter?.search?.trim().toLowerCase() ?? ""
  return REGISTRY_ITEMS.filter((item) => {
    if (filter?.category !== undefined && item.category !== filter.category) return false
    if (q.length === 0) return true
    return (
      item.name.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    )
  })
}

export interface ResolvedRegistryPlan {
  readonly items: ReadonlyArray<RegistryItem>
  readonly dependencies: ReadonlyArray<string>
  readonly missing: ReadonlyArray<string>
}

/**
 * Resolves a set of requested registry item names in topological dependency
 * order with cycle protection.
 */
export const resolveRegistryTree = (
  names: ReadonlyArray<string>
): ResolvedRegistryPlan => {
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const ordered: Array<RegistryItem> = []
  const missing = new Set<string>()
  const deps = new Set<string>()

  const visit = (name: string) => {
    if (visited.has(name) || visiting.has(name)) return
    const item = BY_NAME.get(name)
    if (item === undefined) {
      missing.add(name)
      return
    }
    visiting.add(name)
    for (const dep of item.registryDependencies) {
      visit(dep)
    }
    visiting.delete(name)
    visited.add(name)
    ordered.push(item)
    for (const pkg of item.dependencies) deps.add(pkg)
  }

  for (const name of names) visit(name)

  return {
    items: ordered,
    dependencies: [...deps].sort(),
    missing: [...missing]
  }
}

export interface FileDiffSummary {
  readonly path: string
  readonly status: "same" | "modified" | "missing"
  readonly addedLines: number
  readonly removedLines: number
  readonly patch: string
}

/**
 * Computes a deterministic line-level diff between a local installed file and
 * the canonical registry template (`effect-ui diff`).
 */
export const diffRegistryContent = (
  path: string,
  localContent: string | undefined,
  registryContent: string
): FileDiffSummary => {
  if (localContent === undefined) {
    const regLines = registryContent.split("\n")
    return {
      path,
      status: "missing",
      addedLines: regLines.length,
      removedLines: 0,
      patch: `--- ${path} (missing locally)\n+++ registry/${path}`
    }
  }
  if (localContent === registryContent) {
    return { path, status: "same", addedLines: 0, removedLines: 0, patch: "" }
  }
  const localLines = localContent.split("\n")
  const regLines = registryContent.split("\n")
  const maxLen = Math.max(localLines.length, regLines.length)
  const hunk: Array<string> = [`--- local/${path}`, `+++ registry/${path}`]
  let addedLines = 0
  let removedLines = 0

  for (let i = 0; i < maxLen; i++) {
    const a = localLines[i]
    const b = regLines[i]
    if (a === b) continue
    if (a !== undefined) {
      hunk.push(`-${a}`)
      removedLines++
    }
    if (b !== undefined) {
      hunk.push(`+${b}`)
      addedLines++
    }
  }

  return {
    path,
    status: "modified",
    addedLines,
    removedLines,
    patch: hunk.join("\n")
  }
}
