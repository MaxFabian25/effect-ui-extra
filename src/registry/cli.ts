import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import {
  diffRegistryContent,
  type FileDiffSummary,
  getRegistryItem,
  listRegistryItems,
  resolveRegistryTree
} from "./catalog.js"
import { generatePresetCss, listVisualPresets } from "./presets.js"
import {
  decodePresetName,
  decodeProjectUiConfig,
  DEFAULT_UI_CONFIG,
  encodeProjectUiConfig,
  type IconPack,
  type PresetName,
  type ProjectUiConfig,
  type RegistryCategory
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

export const runAdd = (
  cwd: string,
  names: ReadonlyArray<string>,
  options?: { readonly overwrite?: boolean | undefined }
): AddResult => {
  const config = readProjectUiConfig(cwd)
  const plan = resolveRegistryTree(names)
  if (plan.missing.length > 0) {
    return {
      addedItems: [],
      writtenFiles: [],
      skippedFiles: [],
      dependencies: plan.dependencies,
      missing: plan.missing
    }
  }

  const writtenFiles: Array<string> = []
  const skippedFiles: Array<string> = []
  const installedSet = new Set(config.installed)

  for (const item of plan.items) {
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
    addedItems: plan.items.map((item) => item.name),
    writtenFiles,
    skippedFiles,
    dependencies: plan.dependencies,
    missing: []
  }
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
  presetName: PresetName
): { readonly preset: PresetName; readonly cssPath: string } => {
  const config = readProjectUiConfig(cwd)
  const absCss = resolve(cwd, config.cssPath)
  mkdirSync(dirname(absCss), { recursive: true })
  writeFileSync(absCss, generatePresetCss(presetName), "utf8")
  writeProjectUiConfig(cwd, { ...config, preset: presetName })
  return { preset: presetName, cssPath: config.cssPath }
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
  init [--preset nova|vega|maia|lyra|mira] [--dir src/ui]
  list [--category primitives|layout|data|ai|blocks] [--search term]
  view <name>
  add <name...> [--overwrite]
  diff [name...]
  preset list | apply <nova|vega|maia|lyra|mira>
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
        const dir = getFlag(rest, "--dir")
        const res = runInit(cwd, { preset, dir })
        return {
          exitCode: 0,
          stdout: `Initialized effect-ui (${res.preset}) -> ${res.writtenFiles.join(", ")}\n`,
          stderr: ""
        }
      }
      case "list": {
        const category = getFlag(rest, "--category") as RegistryCategory | undefined
        const search = getFlag(rest, "--search")
        const items = listRegistryItems({ category, search })
        const lines = items.map((i) => `${i.name.padEnd(18)} [${i.category.padEnd(10)}] ${i.description}`)
        return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr: "" }
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
          const name = decodePresetName(target)
          const res = runPreset(cwd, name)
          return {
            exitCode: 0,
            stdout: `Applied preset "${res.preset}" -> ${res.cssPath}\n`,
            stderr: ""
          }
        }
        return { exitCode: 1, stdout: "", stderr: "Usage: effect-ui preset list | apply <name>\n" }
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
