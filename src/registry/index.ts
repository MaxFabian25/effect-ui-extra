export {
  decodeIconPack,
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

export { generateIconModule, type UiIconName } from "./icons.js"

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
  runIconPack,
  runInit,
  runPreset,
  writeProjectUiConfig
} from "./cli.js"

export {
  buildCustomRegistry,
  type CustomRegistryManifest,
  CustomRegistryManifestSchema,
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
