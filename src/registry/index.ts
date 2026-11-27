export {
  decodePresetName,
  decodeProjectUiConfig,
  DEFAULT_UI_CONFIG,
  encodeProjectUiConfig,
  type IconPack,
  IconPackSchema,
  type PresetName,
  PresetNameSchema,
  type ProjectUiConfig,
  ProjectUiConfigSchema,
  type RegistryCategory,
  RegistryCategorySchema,
  type RegistryFile,
  RegistryFileSchema,
  type RegistryItem,
  RegistryItemSchema
} from "./schema.js"

export {
  generatePresetCss,
  getVisualPreset,
  listVisualPresets,
  VISUAL_PRESETS,
  type VisualPreset
} from "./presets.js"

export {
  diffRegistryContent,
  type FileDiffSummary,
  getRegistryItem,
  listRegistryItems,
  REGISTRY_ITEMS,
  type ResolvedRegistryPlan,
  resolveRegistryTree
} from "./catalog.js"

export {
  type AddResult,
  type CliResult,
  CONFIG_FILENAME,
  type InitResult,
  readProjectUiConfig,
  runAdd,
  runCli,
  runDiff,
  runInit,
  runPreset,
  writeProjectUiConfig
} from "./cli.js"
