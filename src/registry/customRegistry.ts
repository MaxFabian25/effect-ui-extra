import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import * as Schema from "effect/Schema"
import { getRegistryItem } from "./catalog.js"
import { type RegistryItem, RegistryItemSchema } from "./schema.js"

export const CustomRegistryManifestSchema = Schema.Struct({
  name: Schema.String,
  homepage: Schema.optional(Schema.String),
  items: Schema.Array(RegistryItemSchema)
})
export type CustomRegistryManifest = typeof CustomRegistryManifestSchema.Type

const decodeCustomRegistryManifest = Schema.decodeUnknownSync(CustomRegistryManifestSchema)

export interface RegistryValidationResult {
  readonly valid: boolean
  readonly errors: ReadonlyArray<string>
  readonly manifest?: CustomRegistryManifest | undefined
}

export interface RegistryBuildResult {
  readonly ok: boolean
  readonly errors: ReadonlyArray<string>
  readonly writtenFiles: ReadonlyArray<string>
  readonly itemCount: number
}

const resolveManifestPath = (pathOrDir: string): string => {
  const abs = resolve(pathOrDir)
  if (existsSync(abs) && statSync(abs).isDirectory()) {
    return join(abs, "registry.json")
  }
  return abs
}

const isSafeRelativePath = (relPath: string): boolean => {
  if (relPath.length === 0 || relPath.startsWith("/") || relPath.startsWith("\\")) return false
  const parts = relPath.split(/[/\\]+/)
  return parts.every((p) => p !== "" && p !== "." && p !== "..")
}

/**
 * Validates a custom shadcn-style Effect UI registry manifest (`registry.json`)
 * for schema compliance, unique item names, safe relative file paths, and
 * resolvable `registryDependencies`.
 */
export const validateCustomRegistry = (pathOrDir: string): RegistryValidationResult => {
  const manifestPath = resolveManifestPath(pathOrDir)
  if (!existsSync(manifestPath)) {
    return { valid: false, errors: [`Manifest not found: ${manifestPath}`] }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8"))
  } catch (err) {
    return {
      valid: false,
      errors: [`Invalid JSON in ${manifestPath}: ${err instanceof Error ? err.message : String(err)}`]
    }
  }

  let manifest: CustomRegistryManifest
  try {
    manifest = decodeCustomRegistryManifest(parsed)
  } catch (err) {
    return {
      valid: false,
      errors: [`Schema validation failed: ${err instanceof Error ? err.message : String(err)}`]
    }
  }

  const errors: Array<string> = []
  if (manifest.name.trim().length === 0) {
    errors.push("Manifest name must be a non-empty string.")
  }

  const localNames = new Set<string>()
  for (const item of manifest.items) {
    if (item.name.trim().length === 0) {
      errors.push("Registry item name must be non-empty.")
      continue
    }
    if (localNames.has(item.name)) {
      errors.push(`Duplicate registry item name: "${item.name}".`)
    }
    localNames.add(item.name)

    if (item.files.length === 0) {
      errors.push(`Item "${item.name}" must declare at least one file.`)
    }
    for (const file of item.files) {
      if (!isSafeRelativePath(file.path)) {
        errors.push(`Item "${item.name}" has unsafe file path "${file.path}".`)
      }
      if (file.content.trim().length === 0) {
        errors.push(`Item "${item.name}" file "${file.path}" has empty content.`)
      }
    }
  }

  for (const item of manifest.items) {
    for (const dep of item.registryDependencies) {
      if (!localNames.has(dep) && getRegistryItem(dep) === undefined) {
        errors.push(`Item "${item.name}" depends on unknown registry item "${dep}".`)
      }
    }
  }

  return errors.length === 0
    ? { valid: true, errors: [], manifest }
    : { valid: false, errors }
}

/**
 * Validates and builds a static distributable registry directory (`index.json`
 * plus per-item `items/<name>.json` artifacts) suitable for hosting on any
 * static origin or GitHub Pages.
 */
export const buildCustomRegistry = (
  pathOrDir: string,
  outDir: string
): RegistryBuildResult => {
  const validation = validateCustomRegistry(pathOrDir)
  if (!validation.valid || validation.manifest === undefined) {
    return { ok: false, errors: validation.errors, writtenFiles: [], itemCount: 0 }
  }

  const { manifest } = validation
  const absOut = resolve(outDir)
  mkdirSync(absOut, { recursive: true })

  const written: Array<string> = []
  const indexPayload = {
    name: manifest.name,
    ...(manifest.homepage !== undefined ? { homepage: manifest.homepage } : {}),
    items: manifest.items.map((item: RegistryItem) => ({
      name: item.name,
      title: item.title,
      category: item.category,
      description: item.description,
      registryDependencies: item.registryDependencies,
      dependencies: item.dependencies,
      files: item.files.map((f) => f.path)
    }))
  }

  const indexPath = join(absOut, "index.json")
  writeFileSync(indexPath, `${JSON.stringify(indexPayload, null, 2)}\n`, "utf8")
  written.push(indexPath)

  for (const item of manifest.items) {
    const itemPath = join(absOut, "items", `${item.name}.json`)
    mkdirSync(dirname(itemPath), { recursive: true })
    writeFileSync(itemPath, `${JSON.stringify(item, null, 2)}\n`, "utf8")
    written.push(itemPath)
  }

  return {
    ok: true,
    errors: [],
    writtenFiles: written,
    itemCount: manifest.items.length
  }
}
