import * as Schema from "effect/Schema"

export const RegistryCategorySchema = Schema.Literals([
  "primitives",
  "layout",
  "data",
  "ai",
  "blocks"
])
export type RegistryCategory = typeof RegistryCategorySchema.Type

export const PresetNameSchema = Schema.Literals([
  "vega",
  "nova",
  "maia",
  "lyra",
  "mira"
])
export type PresetName = typeof PresetNameSchema.Type

export const IconPackSchema = Schema.Literals([
  "lucide",
  "tabler",
  "inline-svg"
])
export type IconPack = typeof IconPackSchema.Type

export const RegistryFileSchema = Schema.Struct({
  /** Path relative to the project's configured UI directory (e.g. `"button.ts"`). */
  path: Schema.String,
  content: Schema.String
})
export type RegistryFile = typeof RegistryFileSchema.Type

export const RegistryItemSchema = Schema.Struct({
  name: Schema.String,
  title: Schema.String,
  category: RegistryCategorySchema,
  description: Schema.String,
  registryDependencies: Schema.Array(Schema.String),
  dependencies: Schema.Array(Schema.String),
  files: Schema.Array(RegistryFileSchema)
})
export type RegistryItem = typeof RegistryItemSchema.Type

export const ProjectUiConfigSchema = Schema.Struct({
  preset: PresetNameSchema,
  dir: Schema.String,
  cssPath: Schema.String,
  iconPack: IconPackSchema,
  installed: Schema.Array(Schema.String)
})
export type ProjectUiConfig = typeof ProjectUiConfigSchema.Type

export const DEFAULT_UI_CONFIG: ProjectUiConfig = {
  preset: "nova",
  dir: "src/ui",
  cssPath: "src/ui/theme.css",
  iconPack: "inline-svg",
  installed: []
}

export const decodeProjectUiConfig = Schema.decodeUnknownSync(ProjectUiConfigSchema)
export const encodeProjectUiConfig = Schema.encodeSync(ProjectUiConfigSchema)
export const decodePresetName = Schema.decodeUnknownSync(PresetNameSchema)
export const decodeIconPack = Schema.decodeUnknownSync(IconPackSchema)
