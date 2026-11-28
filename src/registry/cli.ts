import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import {
  diffRegistryContent,
  type FileDiffSummary,
  getRegistryItem,
  listRegistryItems,
  resolveRegistryTree
} from "./catalog.js"
import {
  buildCustomRegistry,
  loadNamespacedItemAsync,
  loadNamespacedItemSync,
  parseNamespacedItem,
  validateCustomRegistry
} from "./customRegistry.js"
import { generateIconModule } from "./icons.js"
import {
  decodePresetCode,
  encodePresetCode,
  generateCustomPresetCss,
  generatePresetCss,
  listVisualPresets
} from "./presets.js"
import {
  decodeIconPack,
  decodePresetName,
  decodePresetSpec,
  decodeProjectUiConfig,
  DEFAULT_UI_CONFIG,
  encodeProjectUiConfig,
  type IconPack,
  type PresetName,
  type PresetSpec,
  type ProjectUiConfig,
  type RegistryCategory,
  type RegistryItem
} from "./schema.js"

export const CONFIG_FILENAME = "effect-ui.json"

export const readProjectUiConfig = (cwd: string): ProjectUiConfig => {
  const configPath = resolve(cwd, CONFIG_FILENAME)
  if (!existsSync(configPath)) return DEFAULT_UI_CONFIG
  const raw: unknown = JSON.parse(readFileSync(configPath, "utf8"))
  return decodeProjectUiConfig(raw)
}

export const writeProjectUiConfig = (cwd: string, config: ProjectUiConfig): void => {
  const configPath = resolve(cwd, CONFIG_FILENAME)
  writeFileSync(
    configPath,
    `${JSON.stringify(encodeProjectUiConfig(config), null, 2)}\n`,
    "utf8"
  )
}

export interface InitResult {
  readonly configPath: string
  readonly cssPath: string
  readonly preset: PresetName
  readonly iconPack: IconPack
  readonly writtenFiles: ReadonlyArray<string>
}

export const runInit = (
  cwd: string,
  options?: {
    readonly preset?: PresetName | undefined
    readonly dir?: string | undefined
    readonly cssPath?: string | undefined
    readonly iconPack?: IconPack | undefined
  }
): InitResult => {
  const preset = options?.preset ?? DEFAULT_UI_CONFIG.preset
  const dir = options?.dir ?? DEFAULT_UI_CONFIG.dir
  const cssPath = options?.cssPath ?? `${dir}/theme.css`
  const iconPack = options?.iconPack ?? DEFAULT_UI_CONFIG.iconPack

  const written: Array<string> = []
  const absCss = resolve(cwd, cssPath)
  mkdirSync(dirname(absCss), { recursive: true })
  writeFileSync(absCss, generatePresetCss(preset), "utf8")
  written.push(cssPath)

  const iconsRel = `${dir}/icons.ts`
  const absIcons = resolve(cwd, iconsRel)
  mkdirSync(dirname(absIcons), { recursive: true })
  writeFileSync(absIcons, generateIconModule(iconPack), "utf8")
  written.push(iconsRel)

  const cnItem = getRegistryItem("cn")!
  for (const file of cnItem.files) {
    const rel = `${dir}/${file.path}`
    const abs = resolve(cwd, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, file.content, "utf8")
    written.push(rel)
  }

  const config: ProjectUiConfig = {
    preset,
    dir,
    cssPath,
    iconPack,
    installed: ["cn"]
  }
  writeProjectUiConfig(cwd, config)

  return {
    configPath: CONFIG_FILENAME,
    cssPath,
    preset,
    iconPack,
    writtenFiles: written
  }
}

export interface AddResult {
  readonly addedItems: ReadonlyArray<string>
  readonly writtenFiles: ReadonlyArray<string>
  readonly skippedFiles: ReadonlyArray<string>
  readonly dependencies: ReadonlyArray<string>
  readonly missing: ReadonlyArray<string>
}

const writeResolvedItems = (
  cwd: string,
  config: ProjectUiConfig,
  items: ReadonlyArray<RegistryItem>,
  dependencies: ReadonlyArray<string>,
  options?: { readonly overwrite?: boolean | undefined }
): AddResult => {
  const writtenFiles: Array<string> = []
  const skippedFiles: Array<string> = []
  const installedSet = new Set(config.installed)

  for (const item of items) {
    installedSet.add(item.name)
    for (const file of item.files) {
      const rel = `${config.dir}/${file.path}`
      const abs = resolve(cwd, rel)
      if (existsSync(abs) && options?.overwrite !== true) {
        skippedFiles.push(rel)
        continue
      }
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, file.content, "utf8")
      writtenFiles.push(rel)
    }
  }

  writeProjectUiConfig(cwd, {
    ...config,
    installed: [...installedSet].sort()
  })

  return {
    addedItems: items.map((item) => item.name),
    writtenFiles,
    skippedFiles,
    dependencies,
    missing: []
  }
}

export const runAdd = (
  cwd: string,
  names: ReadonlyArray<string>,
  options?: { readonly overwrite?: boolean | undefined }
): AddResult => {
  const config = readProjectUiConfig(cwd)
  const builtinNames: Array<string> = []
  const customItems: Array<RegistryItem> = []
  const missingCustom: Array<string> = []

  for (const spec of names) {
    if (parseNamespacedItem(spec) !== undefined) {
      const loaded = loadNamespacedItemSync(cwd, config.registries, spec)
      if (loaded === undefined) {
        missingCustom.push(spec)
      } else {
        customItems.push(loaded)
        for (const dep of loaded.registryDependencies) builtinNames.push(dep)
      }
    } else {
      builtinNames.push(spec)
    }
  }

  const plan = resolveRegistryTree(builtinNames)
  const missing = [...plan.missing, ...missingCustom]
  if (missing.length > 0) {
    return {
      addedItems: [],
      writtenFiles: [],
      skippedFiles: [],
      dependencies: plan.dependencies,
      missing
    }
  }

  const deps = new Set(plan.dependencies)
  for (const item of customItems) {
    for (const d of item.dependencies) deps.add(d)
  }
  return writeResolvedItems(cwd, config, [...plan.items, ...customItems], [...deps].sort(), options)
}

/** Async variant of `runAdd` supporting remote HTTPS `@namespace/item` registries. */
export const runAddAsync = async (
  cwd: string,
  names: ReadonlyArray<string>,
  options?: {
    readonly overwrite?: boolean | undefined
    readonly fetchImpl?: typeof fetch | undefined
  }
): Promise<AddResult> => {
  const config = readProjectUiConfig(cwd)
  const builtinNames: Array<string> = []
  const customItems: Array<RegistryItem> = []
  const missingCustom: Array<string> = []

  for (const spec of names) {
    if (parseNamespacedItem(spec) !== undefined) {
      const loaded = await loadNamespacedItemAsync(cwd, config.registries, spec, options?.fetchImpl)
      if (loaded === undefined) {
        missingCustom.push(spec)
      } else {
        customItems.push(loaded)
        for (const dep of loaded.registryDependencies) builtinNames.push(dep)
      }
    } else {
      builtinNames.push(spec)
    }
  }

  const plan = resolveRegistryTree(builtinNames)
  const missing = [...plan.missing, ...missingCustom]
  if (missing.length > 0) {
    return {
      addedItems: [],
      writtenFiles: [],
      skippedFiles: [],
      dependencies: plan.dependencies,
      missing
    }
  }

  const deps = new Set(plan.dependencies)
  for (const item of customItems) {
    for (const d of item.dependencies) deps.add(d)
  }
  return writeResolvedItems(cwd, config, [...plan.items, ...customItems], [...deps].sort(), options)
}

export interface ApplyResult {
  readonly updatedFiles: ReadonlyArray<string>
  readonly skippedModified: ReadonlyArray<string>
  readonly unchangedFiles: ReadonlyArray<string>
}

/**
 * Re-applies canonical registry templates to installed blueprints: updates
 * missing files cleanly and skips locally modified files unless `force` is set.
 */
export const runApply = (
  cwd: string,
  options?: {
    readonly names?: ReadonlyArray<string> | undefined
    readonly force?: boolean | undefined
  }
): ApplyResult => {
  const config = readProjectUiConfig(cwd)
  const targets =
    options?.names !== undefined && options.names.length > 0
      ? options.names
      : config.installed
  const plan = resolveRegistryTree(targets)
  const updatedFiles: Array<string> = []
  const skippedModified: Array<string> = []
  const unchangedFiles: Array<string> = []

  for (const item of plan.items) {
    for (const file of item.files) {
      const rel = `${config.dir}/${file.path}`
      const abs = resolve(cwd, rel)
      const local = existsSync(abs) ? readFileSync(abs, "utf8") : undefined
      if (local === file.content) {
        unchangedFiles.push(rel)
        continue
      }
      if (local !== undefined && options?.force !== true) {
        skippedModified.push(rel)
        continue
      }
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, file.content, "utf8")
      updatedFiles.push(rel)
    }
  }

  return { updatedFiles, skippedModified, unchangedFiles }
}

export interface ProjectInfoSummary {
  readonly preset: PresetName
  readonly presetCode?: string | undefined
  readonly iconPack: IconPack
  readonly dir: string
  readonly cssPath: string
  readonly installedCount: number
  readonly modifiedCount: number
  readonly registries: ReadonlyArray<string>
}

export const runInfo = (cwd: string): ProjectInfoSummary => {
  const config = readProjectUiConfig(cwd)
  const diffs = runDiff(cwd)
  return {
    preset: config.preset,
    ...(config.presetCode !== undefined ? { presetCode: config.presetCode } : {}),
    iconPack: config.iconPack,
    dir: config.dir,
    cssPath: config.cssPath,
    installedCount: config.installed.length,
    modifiedCount: diffs.filter((d) => d.status === "modified").length,
    registries: Object.keys(config.registries ?? {}).sort()
  }
}

export const formatItemDocs = (name: string): string | undefined => {
  const item = getRegistryItem(name)
  if (item === undefined) return undefined
  const plan = resolveRegistryTree([name])
  const exportsList = item.files
    .flatMap((f) =>
      [...f.content.matchAll(/export (?:const|function|type|interface) (\w+)/g)].map((m) => m[1]!)
    )
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
  return [
    `# ${item.title} (${item.name})`,
    `Category: ${item.category}`,
    `Summary: ${item.description}`,
    `Install: bunx effect-ui add ${item.name}`,
    `Files: ${item.files.map((f) => f.path).join(", ")}`,
    `Exports: ${exportsList.join(", ") || "none"}`,
    `Registry deps: ${plan.items.map((i) => i.name).join(", ")}`,
    `Package deps: ${plan.dependencies.join(", ") || "none"}`
  ].join("\n")
}

export const runDiff = (
  cwd: string,
  names?: ReadonlyArray<string>
): ReadonlyArray<FileDiffSummary> => {
  const config = readProjectUiConfig(cwd)
  const targets = names !== undefined && names.length > 0 ? names : config.installed
  const plan = resolveRegistryTree(targets)
  const out: Array<FileDiffSummary> = []

  for (const item of plan.items) {
    for (const file of item.files) {
      const rel = `${config.dir}/${file.path}`
      const abs = resolve(cwd, rel)
      const localContent = existsSync(abs) ? readFileSync(abs, "utf8") : undefined
      out.push(diffRegistryContent(rel, localContent, file.content))
    }
  }
  return out
}

export const runPreset = (
  cwd: string,
  presetNameOrCode: PresetName | string
): { readonly preset: PresetName; readonly cssPath: string; readonly presetCode?: string | undefined } => {
  const config = readProjectUiConfig(cwd)
  const absCss = resolve(cwd, config.cssPath)
  mkdirSync(dirname(absCss), { recursive: true })
  if (presetNameOrCode.startsWith("v1-")) {
    const spec: PresetSpec = decodePresetCode(presetNameOrCode)
    const code = encodePresetCode(spec)
    writeFileSync(absCss, generateCustomPresetCss(spec), "utf8")
    writeProjectUiConfig(cwd, { ...config, preset: spec.style, presetCode: code })
    return { preset: spec.style, cssPath: config.cssPath, presetCode: code }
  }
  const presetName = decodePresetName(presetNameOrCode)
  writeFileSync(absCss, generatePresetCss(presetName), "utf8")
  const { presetCode: _drop, ...restConfig } = config
  writeProjectUiConfig(cwd, { ...restConfig, preset: presetName })
  return { preset: presetName, cssPath: config.cssPath }
}

export const runIconPack = (
  cwd: string,
  iconPack: IconPack
): { readonly iconPack: IconPack; readonly iconsPath: string } => {
  const config = readProjectUiConfig(cwd)
  const iconsPath = `${config.dir}/icons.ts`
  const absIcons = resolve(cwd, iconsPath)
  mkdirSync(dirname(absIcons), { recursive: true })
  writeFileSync(absIcons, generateIconModule(iconPack), "utf8")
  writeProjectUiConfig(cwd, { ...config, iconPack })
  return { iconPack, iconsPath }
}

export interface CliResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

const getFlag = (args: ReadonlyArray<string>, flag: string): string | undefined => {
  const idx = args.indexOf(flag)
  if (idx === -1) return undefined
  return args[idx + 1]
}

const HELP_TEXT = `effect-ui — copy-paste styled component registry for @effect/ui

Commands:
  init [--preset nova|vega|maia|lyra|mira|luma|rhea|sera] [--icon-pack inline-svg|lucide|tabler] [--dir src/ui]
  list [--category primitives|layout|data|ai|blocks] [--search term]
  search <query>
  view <name>
  docs <name>
  info
  add <name|@org/item...> [--overwrite]
  apply [name...] [--force]
  diff [name...]
  preset list | apply <style|v1-code> | encode --style <name> [--base ...] [--accent ...] [--radius ...] | decode <code>
  icon-pack <inline-svg|lucide|tabler>
  registry validate [path] | build [path] [--out dist/registry]
  mcp
`

export const runCli = (argv: ReadonlyArray<string>, cwd: string): CliResult => {
  const [cmd, ...rest] = argv
  if (cmd === undefined || cmd === "help" || cmd === "--help" || cmd === "-h") {
    return { exitCode: 0, stdout: HELP_TEXT, stderr: "" }
  }

  try {
    switch (cmd) {
      case "init": {
        const presetRaw = getFlag(rest, "--preset")
        const preset = presetRaw !== undefined ? decodePresetName(presetRaw) : undefined
        const iconPackRaw = getFlag(rest, "--icon-pack")
        const iconPack = iconPackRaw !== undefined ? decodeIconPack(iconPackRaw) : undefined
        const dir = getFlag(rest, "--dir")
        const res = runInit(cwd, { preset, dir, iconPack })
        return {
          exitCode: 0,
          stdout: `Initialized effect-ui (${res.preset}, ${res.iconPack}) -> ${res.writtenFiles.join(", ")}\n`,
          stderr: ""
        }
      }
      case "list": {
        const category = getFlag(rest, "--category") as RegistryCategory | undefined
        const search = getFlag(rest, "--search")
        const items = listRegistryItems({ category, search })
        const lines = items.map((i) => `${i.name.padEnd(22)} [${i.category.padEnd(10)}] ${i.description}`)
        return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr: "" }
      }
      case "search": {
        const query = rest.join(" ").trim()
        if (query.length === 0) {
          return { exitCode: 1, stdout: "", stderr: "Usage: effect-ui search <query>\n" }
        }
        const items = listRegistryItems({ search: query })
        const lines = items.map((i) => `${i.name.padEnd(22)} [${i.category.padEnd(10)}] ${i.description}`)
        return { exitCode: 0, stdout: items.length > 0 ? `${lines.join("\n")}\n` : `No items matching "${query}".\n`, stderr: "" }
      }
      case "docs": {
        const name = rest[0]
        if (name === undefined) {
          return { exitCode: 1, stdout: "", stderr: "Usage: effect-ui docs <name>\n" }
        }
        const doc = formatItemDocs(name)
        if (doc === undefined) {
          return { exitCode: 1, stdout: "", stderr: `Unknown registry item: ${name}\n` }
        }
        return { exitCode: 0, stdout: `${doc}\n`, stderr: "" }
      }
      case "info": {
        const info = runInfo(cwd)
        return {
          exitCode: 0,
          stdout: [
            `Preset: ${info.preset}${info.presetCode !== undefined ? ` (${info.presetCode})` : ""}`,
            `Icon pack: ${info.iconPack}`,
            `Directory: ${info.dir} (CSS: ${info.cssPath})`,
            `Installed: ${info.installedCount} item(s) (${info.modifiedCount} modified locally)`,
            `Custom registries: ${info.registries.join(", ") || "none"}`
          ].join("\n") + "\n",
          stderr: ""
        }
      }
      case "apply": {
        const force = rest.includes("--force")
        const names = rest.filter((a) => !a.startsWith("--"))
        const res = runApply(cwd, { names: names.length > 0 ? names : undefined, force })
        return {
          exitCode: 0,
          stdout: `Applied registry updates (updated ${res.updatedFiles.length}, skipped modified ${res.skippedModified.length}, unchanged ${res.unchangedFiles.length})\n`,
          stderr: ""
        }
      }
      case "view": {
        const name = rest[0]
        if (name === undefined) {
          return { exitCode: 1, stdout: "", stderr: "Usage: effect-ui view <name>\n" }
        }
        const item = getRegistryItem(name)
        if (item === undefined) {
          return { exitCode: 1, stdout: "", stderr: `Unknown registry item: ${name}\n` }
        }
        return {
          exitCode: 0,
          stdout: `${item.name} (${item.category}) — ${item.description}\nFiles: ${item.files.map((f) => f.path).join(", ")}\nDeps: ${item.dependencies.join(", ") || "none"}\n`,
          stderr: ""
        }
      }
      case "add": {
        const overwrite = rest.includes("--overwrite")
        const names = rest.filter((a) => !a.startsWith("--"))
        if (names.length === 0) {
          return { exitCode: 1, stdout: "", stderr: "Usage: effect-ui add <name...> [--overwrite]\n" }
        }
        const res = runAdd(cwd, names, { overwrite })
        if (res.missing.length > 0) {
          return {
            exitCode: 1,
            stdout: "",
            stderr: `Unknown registry item(s): ${res.missing.join(", ")}\n`
          }
        }
        return {
          exitCode: 0,
          stdout: `Added ${res.addedItems.join(", ")} (wrote ${res.writtenFiles.length}, skipped ${res.skippedFiles.length})\n`,
          stderr: ""
        }
      }
      case "diff": {
        const names = rest.filter((a) => !a.startsWith("--"))
        const diffs = runDiff(cwd, names.length > 0 ? names : undefined)
        const changed = diffs.filter((d) => d.status !== "same")
        if (changed.length === 0) {
          return { exitCode: 0, stdout: "All installed components match the registry.\n", stderr: "" }
        }
        const out = changed.map((d) => d.patch).join("\n\n")
        return { exitCode: 0, stdout: `${out}\n`, stderr: "" }
      }
      case "preset": {
        const [sub, target] = rest
        if (sub === "list" || sub === undefined) {
          const lines = listVisualPresets().map(
            (p) => `${p.name.padEnd(8)} (${p.density.padEnd(11)}) ${p.description}`
          )
          return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr: "" }
        }
        if (sub === "apply" && target !== undefined) {
          const res = runPreset(cwd, target)
          return {
            exitCode: 0,
            stdout: `Applied preset "${res.presetCode ?? res.preset}" -> ${res.cssPath}\n`,
            stderr: ""
          }
        }
        if (sub === "encode") {
          const spec = decodePresetSpec({
            style: getFlag(rest, "--style") ?? "nova",
            baseColor: getFlag(rest, "--base") ?? "neutral",
            accent: getFlag(rest, "--accent") ?? "default",
            radius: getFlag(rest, "--radius") ?? "md"
          })
          return { exitCode: 0, stdout: `${encodePresetCode(spec)}\n`, stderr: "" }
        }
        if (sub === "decode" && target !== undefined) {
          const spec = decodePresetCode(target)
          return { exitCode: 0, stdout: `${JSON.stringify(spec)}\n`, stderr: "" }
        }
        return { exitCode: 1, stdout: "", stderr: "Usage: effect-ui preset list | apply <style|code> | encode | decode <code>\n" }
      }
      case "icon-pack": {
        const target = rest[0]
        if (target === undefined) {
          return { exitCode: 1, stdout: "", stderr: "Usage: effect-ui icon-pack <inline-svg|lucide|tabler>\n" }
        }
        const pack = decodeIconPack(target)
        const res = runIconPack(cwd, pack)
        return {
          exitCode: 0,
          stdout: `Switched icon pack to "${res.iconPack}" -> ${res.iconsPath}\n`,
          stderr: ""
        }
      }
      case "registry": {
        const [sub, ...subRest] = rest
        const positional = subRest.filter((a, i) => !a.startsWith("--") && (i === 0 || subRest[i - 1] !== "--out"))
        const sourcePath = resolve(cwd, positional[0] ?? "registry.json")
        if (sub === "validate") {
          const res = validateCustomRegistry(sourcePath)
          if (!res.valid) {
            return { exitCode: 1, stdout: "", stderr: `${res.errors.join("\n")}\n` }
          }
          return {
            exitCode: 0,
            stdout: `Valid registry "${res.manifest?.name}" (${res.manifest?.items.length ?? 0} items)\n`,
            stderr: ""
          }
        }
        if (sub === "build") {
          const outFlag = getFlag(subRest, "--out") ?? "dist/registry"
          const res = buildCustomRegistry(sourcePath, resolve(cwd, outFlag))
          if (!res.ok) {
            return { exitCode: 1, stdout: "", stderr: `${res.errors.join("\n")}\n` }
          }
          return {
            exitCode: 0,
            stdout: `Built ${res.itemCount} registry item(s) -> ${outFlag}\n`,
            stderr: ""
          }
        }
        return {
          exitCode: 1,
          stdout: "",
          stderr: "Usage: effect-ui registry validate [path] | build [path] [--out dist/registry]\n"
        }
      }
      case "mcp": {
        return {
          exitCode: 0,
          stdout: "Run `effect-ui mcp` via the CLI entrypoint to serve JSON-RPC 2.0 over stdio.\n",
          stderr: ""
        }
      }
      default:
        return { exitCode: 1, stdout: "", stderr: `Unknown command: ${cmd}\n${HELP_TEXT}` }
    }
  } catch (err) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `${err instanceof Error ? err.message : String(err)}\n`
    }
  }
}
