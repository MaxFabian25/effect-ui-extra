import { UiSchema } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { closeIcon, resolveDir } from "./internal.js"

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
  maxTokens: Schema.optional(Schema.Finite),
  dir: Schema.optional(Schema.Literals(["ltr", "rtl"])),
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
  HighlightedChip: { index: Schema.NullOr(Schema.Finite) },
  RemovedChip: { index: Schema.Finite },
  FocusDone: {}
})

const inputRef = Html.ref("TokenInputField", "input")

const srOnlyStyle =
  "position:fixed;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0"

const rejectionReason = (
  tokens: ReadonlyArray<string>,
  maxTokens: number | undefined
): string =>
  maxTokens !== undefined && tokens.length >= maxTokens
    ? `Maximum of ${maxTokens} items reached`
    : "Item already added"

/**
 * Accessible multi-value chip/tag input with Enter/comma tokenization,
 * Backspace/Delete highlight-then-delete, RTL arrow navigation, screen-reader
 * status announcements, and keyboard chip removal.
 */
export const TokenInput = Html.component({
  name: "TokenInput",
  props: TokenInputProps,
  model: Schema.Struct({
    draft: Schema.String,
    highlightedIndex: Schema.NullOr(Schema.Finite),
    announcement: Schema.String
  }),
  message: TokenInputMsg,
  events: TokenInputEvents
}).make({
  init: () => ({ draft: "", highlightedIndex: null, announcement: "" }),
  update: {
    InputChanged: ($, { value }) => {
      if (value.includes(",") || value.includes("\n")) {
        const parsed = parseTokenText(value)
        const nextTokens = addTokens($.props.tokens, parsed, {
          allowDuplicates: $.props.allowDuplicates,
          maxTokens: $.props.maxTokens
        })
        if (nextTokens.length > $.props.tokens.length) {
          return $.evolve({
            draft: "",
            highlightedIndex: null,
            announcement: `Added ${nextTokens.slice($.props.tokens.length).join(", ")}`
          }).emit(TokenInputEvents.TokensChanged({ tokens: [...nextTokens] }))
        }
        return $.evolve({
          draft: value.replace(/[,\n]+/g, ""),
          highlightedIndex: null,
          announcement: rejectionReason($.props.tokens, $.props.maxTokens)
        })
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
      if (nextTokens.length !== $.props.tokens.length) {
        return $.evolve({
          draft: "",
          highlightedIndex: null,
          announcement: `Added ${nextTokens.slice($.props.tokens.length).join(", ")}`
        }).emit(TokenInputEvents.TokensChanged({ tokens: [...nextTokens] }))
      }
      return $.evolve({
        highlightedIndex: null,
        announcement: rejectionReason($.props.tokens, $.props.maxTokens)
      })
    },
    HighlightedChip: ($, { index }) => {
      const token = index !== null ? $.props.tokens[index] : undefined
      return $.evolve({
        highlightedIndex: index,
        announcement:
          token !== undefined ? `${token} selected, press Backspace or Delete to remove` : ""
      })
    },
    RemovedChip: ($, { index }) => {
      const removed = $.props.tokens[index]
      const nextTokens = removeTokenAt($.props.tokens, index)
      return $.evolve({
        highlightedIndex: null,
        announcement: removed !== undefined ? `Removed ${removed}` : ""
      })
        .emit(TokenInputEvents.TokensChanged({ tokens: [...nextTokens] }))
        .run(HtmlCommand.focus(inputRef, () => TokenInputMsg.FocusDone()))
    },
    FocusDone: ($) => $.model
  },
  view: (h, model) => {
    const p = h.props
    const prefix = p.idPrefix ?? "tokens"
    const activeChipId =
      model.highlightedIndex !== null && p.tokens[model.highlightedIndex] !== undefined
        ? `${prefix}-chip-${model.highlightedIndex}`
        : undefined

    return h.div
      .attrs({
        "data-token-input": "",
        role: "group",
        "aria-label": p.label,
        ...(p.dir !== undefined ? { dir: p.dir } : {})
      })
      .children(
        ...p.tokens.map((token, idx) => {
          const isHighlighted = model.highlightedIndex === idx
          return h.span
            .key(`${token}-${idx}`)
            .attrs({
              id: `${prefix}-chip-${idx}`,
              "data-token-chip": "",
              ...(isHighlighted ? { "data-highlighted": "true" } : {})
            })
            .children(
              h.span.children(token),
              h.button
                .attrs({
                  type: "button",
                  "aria-label": `Remove ${token}`
                })
                .on("click", () => TokenInputMsg.RemovedChip({ index: idx }))
                .children(closeIcon(h))
            )
        }),
        h.input
          .ref(inputRef)
          .attrs({
            id: `${prefix}-input`,
            type: "text",
            "aria-label": p.label,
            autocomplete: "off",
            autocapitalize: "none",
            autocorrect: "off",
            spellcheck: "false",
            ...(activeChipId !== undefined
              ? { "aria-activedescendant": activeChipId }
              : {}),
            ...(p.placeholder !== undefined ? { placeholder: p.placeholder } : {})
          })
          .value(model.draft)
          .on("input", ({ value }) => TokenInputMsg.InputChanged({ value }))
          .on(
            "keydown",
            ({ key, composing }) => {
              if (composing) return undefined
              const isRtl = resolveDir(p.dir) === "rtl"
              const prevKey = isRtl ? "ArrowRight" : "ArrowLeft"
              const nextKey = isRtl ? "ArrowLeft" : "ArrowRight"
              if (key === "Enter") {
                return model.draft.trim() !== ""
                  ? TokenInputMsg.CommittedDraft()
                  : undefined
              }
              if (key === "Delete" && model.highlightedIndex !== null) {
                return TokenInputMsg.RemovedChip({ index: model.highlightedIndex })
              }
              if (key === "Backspace" && model.draft === "" && p.tokens.length > 0) {
                if (model.highlightedIndex !== null) {
                  return TokenInputMsg.RemovedChip({ index: model.highlightedIndex })
                }
                return TokenInputMsg.HighlightedChip({ index: p.tokens.length - 1 })
              }
              if (key === prevKey && model.draft === "" && p.tokens.length > 0) {
                const next =
                  model.highlightedIndex === null
                    ? p.tokens.length - 1
                    : Math.max(0, model.highlightedIndex - 1)
                return TokenInputMsg.HighlightedChip({ index: next })
              }
              if (key === nextKey && model.highlightedIndex !== null) {
                const next =
                  model.highlightedIndex >= p.tokens.length - 1
                    ? null
                    : model.highlightedIndex + 1
                return TokenInputMsg.HighlightedChip({ index: next })
              }
              return undefined
            },
            { preventDefault: true }
          ),
        h.div
          .attrs({
            role: "status",
            "aria-live": "polite",
            "aria-atomic": "true",
            style: srOnlyStyle
          })
          .children(model.announcement)
      )
  }
})
