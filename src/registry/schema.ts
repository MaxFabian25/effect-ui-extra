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
  "mira",
  "luma",
  "rhea",
  "sera"
])
export type PresetName = typeof PresetNameSchema.Type

export const BaseColorSchema = Schema.Literals([
  "neutral",
  "slate",
  "zinc",
  "stone",
  "gray"
])
export type BaseColor = typeof BaseColorSchema.Type

export const AccentColorSchema = Schema.Literals([
  "default",
  "blue",
  "emerald",
  "amber",
  "rose",
  "violet"
])
export type AccentColor = typeof AccentColorSchema.Type

export const RadiusScaleSchema = Schema.Literals([
  "none",
  "sm",
  "md",
  "lg",
  "full"
])
export type RadiusScale = typeof RadiusScaleSchema.Type

export const PresetSpecSchema = Schema.Struct({
  style: PresetNameSchema,
  baseColor: BaseColorSchema,
  accent: AccentColorSchema,
  radius: RadiusScaleSchema
})
export type PresetSpec = typeof PresetSpecSchema.Type

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
  installed: Schema.Array(Schema.String),
  presetCode: Schema.optional(Schema.String),
  registries: Schema.optional(Schema.Record(Schema.String, Schema.String))
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
export const decodePresetSpec = Schema.decodeUnknownSync(PresetSpecSchema)
