export {
  type AccentColor,
  AccentColorSchema,
  type BaseColor,
  BaseColorSchema,
  decodeIconPack,
  decodePresetName,
  decodePresetSpec,
  decodeProjectUiConfig,
  DEFAULT_UI_CONFIG,
  encodeProjectUiConfig,
  type IconPack,
  IconPackSchema,
  type PresetName,
  PresetNameSchema,
  type PresetSpec,
  PresetSpecSchema,
  type ProjectUiConfig,
  ProjectUiConfigSchema,
  type RadiusScale,
  RadiusScaleSchema,
  type RegistryCategory,
  RegistryCategorySchema,
  type RegistryFile,
  RegistryFileSchema,
  type RegistryItem,
  RegistryItemSchema
} from "./schema.js"

export { generateIconModule, type UiIconName } from "./icons.js"

export {
  composeVisualPreset,
  decodePresetCode,
  encodePresetCode,
  generateCustomPresetCss,
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
  type ApplyResult,
  type CliResult,
  CONFIG_FILENAME,
  formatItemDocs,
  type InitResult,
  type ProjectInfoSummary,
  readProjectUiConfig,
  runAdd,
  runAddAsync,
  runApply,
  runCli,
  runDiff,
  runIconPack,
  runInfo,
  runInit,
  runPreset,
  writeProjectUiConfig
} from "./cli.js"

export {
  buildCustomRegistry,
  type CustomRegistryManifest,
  CustomRegistryManifestSchema,
  loadNamespacedItemAsync,
  loadNamespacedItemSync,
  type NamespacedRef,
  parseNamespacedItem,
  type RegistryBuildResult,
  type RegistryValidationResult,
  validateCustomRegistry
} from "./customRegistry.js"

export {
  handleMcpLine,
  handleMcpRequest,
  type JsonRpcRequest,
  type JsonRpcResponse,
  MCP_PROTOCOL_VERSION,
  MCP_TOOL_DEFINITIONS,
  type McpToolDefinition,
  runMcpServer
} from "./mcp.js"
