import { createInterface } from "node:readline"
import { getRegistryItem, listRegistryItems, resolveRegistryTree } from "./catalog.js"
import { listVisualPresets } from "./presets.js"
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
    description: "List the 5 WCAG-audited OKLCH visual presets (vega, nova, maia, lyra, mira).",
    inputSchema: {
      type: "object",
      properties: {}
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

const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  "primitives",
  "layout",
  "data",
  "ai",
  "blocks"
])

const readStringArray = (value: unknown): ReadonlyArray<string> | undefined => {
  if (!Array.isArray(value)) return undefined
  if (!value.every((v) => typeof v === "string")) return undefined
  return value
}

const callTool = (name: string, args: Record<string, unknown>) => {
  switch (name) {
    case "list_items": {
      const rawCat = typeof args.category === "string" ? args.category : undefined
      if (rawCat !== undefined && !VALID_CATEGORIES.has(rawCat)) {
        return textResult({ error: `Invalid category: ${rawCat}` }, true)
      }
      const search = typeof args.search === "string" ? args.search : undefined
      const items = listRegistryItems({
        category: rawCat as RegistryCategory | undefined,
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
  if (typeof raw !== "object" || raw === null || !("method" in raw)) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid Request" }
    }
  }
  const req = raw as JsonRpcRequest
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
            version: "0.4.0"
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
      const toolArgs =
        typeof params.arguments === "object" && params.arguments !== null
          ? (params.arguments as Record<string, unknown>)
          : {}
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
