export type StructuredTokenStatus = "ready" | "pending" | "unresolved"

export interface StructuredToken {
  readonly id: string
  /** Semantic category such as `"mention"`, `"file"`, `"skill"`, or `"command"`. */
  readonly type: string
  /** Stable identifier passed to backend or agent actions. */
  readonly value: string
  /** Human-readable chip text. */
  readonly label: string
  readonly status: StructuredTokenStatus
}

/** Inserts or replaces a structured token by `id` (or by `type + value` when deduplicating). */
export const upsertStructuredToken = (
  tokens: ReadonlyArray<StructuredToken>,
  token: Omit<StructuredToken, "status"> & { readonly status?: StructuredTokenStatus | undefined }
): ReadonlyArray<StructuredToken> => {
  const normalized: StructuredToken = {
    ...token,
    status: token.status ?? "ready"
  }
  const idx = tokens.findIndex(
    (t) => t.id === normalized.id || (t.type === normalized.type && t.value === normalized.value)
  )
  if (idx === -1) return [...tokens, normalized]
  return tokens.map((t, i) => (i === idx ? normalized : t))
}

/** Updates the resolution status (and optionally `value`/`label`) of an existing structured token. */
export const resolveStructuredToken = (
  tokens: ReadonlyArray<StructuredToken>,
  id: string,
  patch: {
    readonly status: StructuredTokenStatus
    readonly value?: string | undefined
    readonly label?: string | undefined
  }
): ReadonlyArray<StructuredToken> =>
  tokens.map((t) =>
    t.id === id
      ? {
          ...t,
          status: patch.status,
          ...(patch.value !== undefined ? { value: patch.value } : {}),
          ...(patch.label !== undefined ? { label: patch.label } : {})
        }
      : t
  )

/** Returns `true` when every structured token is `"ready"` and safe to submit. */
export const areStructuredTokensReady = (
  tokens: ReadonlyArray<StructuredToken>
): boolean => tokens.every((t) => t.status === "ready")

/** Serializes structured tokens + free text into a deterministic prompt prefix string. */
export const serializeStructuredPrompt = (
  tokens: ReadonlyArray<StructuredToken>,
  text: string
): string => {
  const prefix = tokens.map((t) => `[${t.type}:${t.value}]`).join(" ")
  const trimmed = text.trim()
  if (prefix.length === 0) return trimmed
  if (trimmed.length === 0) return prefix
  return `${prefix} ${trimmed}`
}
