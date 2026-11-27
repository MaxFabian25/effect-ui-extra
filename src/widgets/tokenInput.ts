import { UiSchema } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import * as Schema from "effect/Schema"

export const parseTokenText = (
  raw: string,
  delimiters: ReadonlyArray<string> = [",", "\n", "\t"]
): ReadonlyArray<string> => {
  if (raw.trim() === "") return []
  const escaped = delimiters.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const re = new RegExp(`[${escaped.join("")}]+`)
  return raw
    .split(re)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

export const addTokens = (
  current: ReadonlyArray<string>,
  incoming: ReadonlyArray<string>,
  options: {
    readonly allowDuplicates?: boolean | undefined
    readonly maxTokens?: number | undefined
  } = {}
): ReadonlyArray<string> => {
  const allowDuplicates = options.allowDuplicates ?? false
  const maxTokens = options.maxTokens ?? Number.POSITIVE_INFINITY
  const next = [...current]
  const seen = new Set(current.map((t) => t.toLowerCase()))

  for (const raw of incoming) {
    const token = raw.trim()
    if (token === "") continue
    if (next.length >= maxTokens) break
    if (!allowDuplicates && seen.has(token.toLowerCase())) continue
    seen.add(token.toLowerCase())
    next.push(token)
  }
  return next
}

export const removeTokenAt = (
  tokens: ReadonlyArray<string>,
  index: number
): ReadonlyArray<string> =>
  index < 0 || index >= tokens.length
    ? [...tokens]
    : [...tokens.slice(0, index), ...tokens.slice(index + 1)]

export const TokenInputProps = Schema.Struct({
  label: Schema.String,
  tokens: Schema.Array(Schema.String),
  placeholder: Schema.optional(Schema.String),
  allowDuplicates: Schema.optional(Schema.Boolean),
  maxTokens: Schema.optional(Schema.Number),
  idPrefix: Schema.optional(Schema.String)
})
export type TokenInputProps = typeof TokenInputProps.Type

export const TokenInputEvents = UiSchema.TaggedEnum({
  TokensChanged: { tokens: Schema.Array(Schema.String) }
})
export type TokenInputEvents = typeof TokenInputEvents.Type

const TokenInputMsg = UiSchema.TaggedEnum({
  InputChanged: { value: Schema.String },
  CommittedDraft: {},
  HighlightedChip: { index: Schema.NullOr(Schema.Number) },
  RemovedChip: { index: Schema.Number },
  FocusDone: {}
})

const inputRef = Html.ref("TokenInputField", "input")

/**
 * Accessible multi-value chip/tag input with Enter/comma tokenization,
 * Backspace highlight-then-delete, and keyboard chip removal.
 */
export const TokenInput = Html.component({
  name: "TokenInput",
  props: TokenInputProps,
  model: Schema.Struct({
    draft: Schema.String,
    highlightedIndex: Schema.NullOr(Schema.Number)
  }),
  message: TokenInputMsg,
  events: TokenInputEvents
}).make({
  init: () => ({ draft: "", highlightedIndex: null }),
  update: {
    InputChanged: ($, { value }) => {
      if (value.includes(",") || value.includes("\n")) {
        const parsed = parseTokenText(value)
        const nextTokens = addTokens($.props.tokens, parsed, {
          allowDuplicates: $.props.allowDuplicates,
          maxTokens: $.props.maxTokens
        })
        const changed = nextTokens.length !== $.props.tokens.length
        const base = $.evolve({ draft: "", highlightedIndex: null })
        return changed
          ? base.emit(TokenInputEvents.TokensChanged({ tokens: [...nextTokens] }))
          : base
      }
      return $.evolve({ draft: value, highlightedIndex: null })
    },
    CommittedDraft: ($) => {
      const parsed = parseTokenText($.model.draft)
      if (parsed.length === 0) return $.model
      const nextTokens = addTokens($.props.tokens, parsed, {
        allowDuplicates: $.props.allowDuplicates,
        maxTokens: $.props.maxTokens
      })
      const base = $.evolve({ draft: "", highlightedIndex: null })
      return nextTokens.length !== $.props.tokens.length
        ? base.emit(TokenInputEvents.TokensChanged({ tokens: [...nextTokens] }))
        : base
    },
    HighlightedChip: ($, { index }) =>
      $.evolve({ highlightedIndex: index }),
    RemovedChip: ($, { index }) => {
      const nextTokens = removeTokenAt($.props.tokens, index)
      return $.evolve({ highlightedIndex: null })
        .emit(TokenInputEvents.TokensChanged({ tokens: [...nextTokens] }))
        .run(HtmlCommand.focus(inputRef, () => TokenInputMsg.FocusDone()))
    },
    FocusDone: ($) => $.model
  },
  view: (h, model) => {
    const p = h.props
    const prefix = p.idPrefix ?? "tokens"

    return h.div
      .attrs({ "data-token-input": "", role: "group", "aria-label": p.label })
      .children(
        ...p.tokens.map((token, idx) =>
          h.span
            .key(`${token}-${idx}`)
            .attrs({
              "data-token-chip": "",
              "data-highlighted": model.highlightedIndex === idx ? "true" : "false"
            })
            .children(
              h.span.children(token),
              h.button
                .attrs({
                  type: "button",
                  "aria-label": `Remove ${token}`
                })
                .on("click", () => TokenInputMsg.RemovedChip({ index: idx }))
                .children("×")
            )
        ),
        h.input
          .ref(inputRef)
          .attrs({
            id: `${prefix}-input`,
            type: "text",
            "aria-label": p.label,
            placeholder: p.placeholder
          })
          .value(model.draft)
          .on("input", ({ value }) => TokenInputMsg.InputChanged({ value }))
          .on(
            "keydown",
            ({ key, composing }) => {
              if (composing) return undefined
              if (key === "Enter") {
                return model.draft.trim() !== ""
                  ? TokenInputMsg.CommittedDraft()
                  : undefined
              }
              if (key === "Backspace" && model.draft === "" && p.tokens.length > 0) {
                if (model.highlightedIndex !== null) {
                  return TokenInputMsg.RemovedChip({ index: model.highlightedIndex })
                }
                return TokenInputMsg.HighlightedChip({ index: p.tokens.length - 1 })
              }
              if (key === "ArrowLeft" && model.draft === "" && p.tokens.length > 0) {
                const next =
                  model.highlightedIndex === null
                    ? p.tokens.length - 1
                    : Math.max(0, model.highlightedIndex - 1)
                return TokenInputMsg.HighlightedChip({ index: next })
              }
              if (key === "ArrowRight" && model.highlightedIndex !== null) {
                const next =
                  model.highlightedIndex >= p.tokens.length - 1
                    ? null
                    : model.highlightedIndex + 1
                return TokenInputMsg.HighlightedChip({ index: next })
              }
              return undefined
            },
            { preventDefault: true }
          )
      )
  }
})
