import { createInterface } from "node:readline"
import { Schema } from "effect"
import { getRegistryItem, listRegistryItems, resolveRegistryTree } from "./catalog.js"
import { formatItemDocs } from "./cli.js"
import { encodePresetCode, listVisualPresets } from "./presets.js"
import { decodePresetSpec, RegistryCategorySchema } from "./schema.js"
import type { RegistryCategory } from "./schema.js"

export interface JsonRpcRequest {
  readonly jsonrpc?: string | undefined
  readonly id?: string | number | null | undefined
  readonly method: string
  readonly params?: Record<string, unknown> | undefined
}

export interface JsonRpcResponse {
  readonly jsonrpc: "2.0"
  readonly id: string | number | null
  readonly result?: unknown
  readonly error?: {
    readonly code: number
    readonly message: string
  } | undefined
}

export interface McpToolDefinition {
  readonly name: string
  readonly description: string
  readonly inputSchema: Record<string, unknown>
}

export const MCP_PROTOCOL_VERSION = "2024-11-05"

export const MCP_TOOL_DEFINITIONS: ReadonlyArray<McpToolDefinition> = [
  {
    name: "list_items",
    description: "List styled Effect UI registry blueprints, optionally filtered by category or search text.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["primitives", "layout", "data", "ai", "blocks"]
        },
        search: { type: "string" }
      }
    }
  },
  {
    name: "search_items",
    description: "Search the Effect UI registry by name, title, or description.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" }
      },
      required: ["query"]
    }
  },
  {
    name: "view_items",
    description: "Return full metadata and source files for one or more registry items.",
    inputSchema: {
      type: "object",
      properties: {
        names: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["names"]
    }
  },
  {
    name: "list_presets",
    description: "List all 8 WCAG-audited OKLCH visual presets (vega, nova, maia, lyra, mira, luma, rhea, sera).",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "compose_preset",
    description: "Compose a shareable v1 preset code combining style, baseColor, accent, and radius.",
    inputSchema: {
      type: "object",
      properties: {
        style: { type: "string", enum: ["vega", "nova", "maia", "lyra", "mira", "luma", "rhea", "sera"] },
        baseColor: { type: "string", enum: ["neutral", "slate", "zinc", "stone", "gray"] },
        accent: { type: "string", enum: ["default", "blue", "emerald", "amber", "rose", "violet"] },
        radius: { type: "string", enum: ["none", "sm", "md", "lg", "full"] }
      },
      required: ["style"]
    }
  },
  {
    name: "get_item_docs",
    description: "Return exported symbols, file paths, dependencies, and install command for a registry item.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" }
      },
      required: ["name"]
    }
  },
  {
    name: "get_add_command",
    description: "Resolve transitive registry dependencies and return the exact `effect-ui add` CLI command.",
    inputSchema: {
      type: "object",
      properties: {
        names: {
          type: "array",
          items: { type: "string" }
        },
        overwrite: { type: "boolean" }
      },
      required: ["names"]
    }
  },
  {
    name: "get_audit_checklist",
    description: "Return the 4-gate accessibility, SSR purity, and WCAG contrast verification checklist for Effect UI.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
]

const textResult = (payload: unknown, isError = false) => ({
  content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  ...(isError ? { isError: true } : {})
})

const readStringArray = (value: unknown): ReadonlyArray<string> | undefined => {
  if (!Array.isArray(value)) return undefined
  if (!value.every((v) => typeof v === "string")) return undefined
  return value
}

const isRegistryCategory = Schema.is(RegistryCategorySchema)

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const parseJsonRpcRequest = (raw: unknown): JsonRpcRequest | undefined => {
  if (!isPlainRecord(raw)) return undefined
  if (typeof raw["method"] !== "string") return undefined
  const rawId = raw["id"]
  const id =
    rawId === null || typeof rawId === "string" || typeof rawId === "number"
      ? rawId
      : undefined
  const rawParams = raw["params"]
  const params = isPlainRecord(rawParams) ? rawParams : undefined
  const jsonrpc = typeof raw["jsonrpc"] === "string" ? raw["jsonrpc"] : undefined
  return { jsonrpc, id, method: raw["method"], params }
}

const callTool = (name: string, args: Record<string, unknown>) => {
  switch (name) {
    case "list_items": {
      const rawCat = typeof args.category === "string" ? args.category : undefined
      let category: RegistryCategory | undefined
      if (rawCat !== undefined) {
        if (!isRegistryCategory(rawCat)) {
          return textResult({ error: `Invalid category: ${rawCat}` }, true)
        }
        category = rawCat
      }
      const search = typeof args.search === "string" ? args.search : undefined
      const items = listRegistryItems({
        category,
        search
      }).map((i) => ({
        name: i.name,
        title: i.title,
        category: i.category,
        description: i.description,
        files: i.files.map((f) => f.path)
      }))
      return textResult({ count: items.length, items })
    }
    case "search_items": {
      const query = typeof args.query === "string" ? args.query : ""
      const items = listRegistryItems({ search: query }).map((i) => ({
        name: i.name,
        title: i.title,
        category: i.category,
        description: i.description
      }))
      return textResult({ query, count: items.length, items })
    }
    case "view_items": {
      const names = readStringArray(args.names)
      if (names === undefined || names.length === 0) {
        return textResult({ error: "Expected non-empty string array `names`." }, true)
      }
      const found = []
      const missing: Array<string> = []
      for (const n of names) {
        const item = getRegistryItem(n)
        if (item === undefined) missing.push(n)
        else found.push(item)
      }
      return textResult({ items: found, missing }, missing.length > 0 && found.length === 0)
    }
    case "list_presets": {
      const presets = listVisualPresets().map((p) => ({
        name: p.name,
        density: p.density,
        radiusMd: p.radiusMd,
        description: p.description
      }))
      return textResult({ presets })
    }
    case "compose_preset": {
      try {
        const spec = decodePresetSpec({
          style: typeof args.style === "string" ? args.style : "nova",
          baseColor: typeof args.baseColor === "string" ? args.baseColor : "neutral",
          accent: typeof args.accent === "string" ? args.accent : "default",
          radius: typeof args.radius === "string" ? args.radius : "md"
        })
        const code = encodePresetCode(spec)
        return textResult({ code, spec, applyCommand: `bunx effect-ui preset apply ${code}` })
      } catch (err) {
        return textResult({ error: err instanceof Error ? err.message : String(err) }, true)
      }
    }
    case "get_item_docs": {
      const target = typeof args.name === "string" ? args.name : ""
      const docs = formatItemDocs(target)
      if (docs === undefined) {
        return textResult({ error: `Unknown registry item: ${target}` }, true)
      }
      return textResult({ name: target, docs })
    }
    case "get_add_command": {
      const names = readStringArray(args.names)
      if (names === undefined || names.length === 0) {
        return textResult({ error: "Expected non-empty string array `names`." }, true)
      }
      const overwrite = args.overwrite === true
      const plan = resolveRegistryTree(names)
      if (plan.missing.length > 0) {
        return textResult({ error: "Unknown registry items", missing: plan.missing }, true)
      }
      const cmd = `bunx effect-ui add ${names.join(" ")}${overwrite ? " --overwrite" : ""}`
      return textResult({
        command: cmd,
        resolvedItems: plan.items.map((i) => i.name),
        dependencies: plan.dependencies
      })
    }
    case "get_audit_checklist": {
      return textResult({
        gates: [
          {
            id: "apg-pattern",
            module: "effect-ui-extra/a11y",
            check: "checkPattern(play, pattern) and checkDirection(...)"
          },
          {
            id: "accessible-names",
            module: "effect-ui-extra/a11y",
            check: "checkAccessibleNames(play)"
          },
          {
            id: "ssr-purity",
            module: "effect-ui-extra/page",
            check: "checkServer(Component, props)"
          },
          {
            id: "wcag-contrast",
            module: "effect-ui-extra/theme",
            check: "auditThemeContrast(themeContrastPairs(tokens))"
          }
        ]
      })
    }
    default:
      return textResult({ error: `Unknown tool: ${name}` }, true)
  }
}

/**
 * Pure JSON-RPC 2.0 dispatcher for the `effect-ui mcp` server. Returns `null`
 * for notifications that expect no response.
 */
export const handleMcpRequest = (raw: unknown): JsonRpcResponse | null => {
  const req = parseJsonRpcRequest(raw)
  if (req === undefined) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid Request" }
    }
  }
  const id = req.id ?? null

  if (req.method === "notifications/initialized") {
    return null
  }

  switch (req.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: {
            name: "effect-ui-registry",
            version: "0.5.0"
          }
        }
      }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} }
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: MCP_TOOL_DEFINITIONS }
      }
    case "tools/call": {
      const params = req.params ?? {}
      const toolName = typeof params.name === "string" ? params.name : ""
      const toolArgs = isPlainRecord(params.arguments) ? params.arguments : {}
      return {
        jsonrpc: "2.0",
        id,
        result: callTool(toolName, toolArgs)
      }
    }
    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${req.method}` }
      }
  }
}

/** Parses one JSON-RPC line and serializes the response line (or `null` for notifications). */
export const handleMcpLine = (line: string): string | null => {
  const trimmed = line.trim()
  if (trimmed.length === 0) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" }
    })
  }
  const res = handleMcpRequest(parsed)
  return res === null ? null : JSON.stringify(res)
}

/** Runs the `effect-ui mcp` JSON-RPC 2.0 server over line-delimited stdio. */
export const runMcpServer = async (
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout
): Promise<void> => {
  const rl = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY })
  for await (const line of rl) {
    const out = handleMcpLine(line)
    if (out !== null) {
      output.write(`${out}\n`)
    }
  }
}
