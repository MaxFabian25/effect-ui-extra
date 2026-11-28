import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { fuzzyFilter } from "./fuzzy.js"
import { safeIdToken } from "./internal.js"

export interface TriggerMatch {
  readonly trigger: string
  readonly query: string
  readonly rangeStart: number
  readonly rangeEnd: number
}

/**
 * Detects an active inline trigger token (such as `@alice`, `/cmd`, or `#tag`)
 * immediately before `caret` in `text`. A trigger only opens at start-of-string
 * or after whitespace so email addresses (`a@b.com`) do not falsely open.
 */
export const detectTrigger = (
  text: string,
  caret: number,
  triggers: ReadonlyArray<string> = ["@", "/", "#"]
): TriggerMatch | undefined => {
  const pos = Math.max(0, Math.min(text.length, caret))
  const before = text.slice(0, pos)

  for (let i = pos - 1; i >= 0; i--) {
    const ch = before[i]!
    if (/\s/.test(ch)) return undefined
    if (triggers.includes(ch)) {
      const prev = i === 0 ? undefined : before[i - 1]
      if (prev !== undefined && !/\s/.test(prev)) return undefined
      return {
        trigger: ch,
        query: before.slice(i + 1, pos),
        rangeStart: i,
        rangeEnd: pos
      }
    }
  }
  return undefined
}

/**
 * Replaces the matched trigger range in `text` with `replacement` (plus an
 * optional trailing space) and returns the updated string and new caret offset.
 */
export const applyTriggerSelection = (
  text: string,
  match: TriggerMatch,
  replacement: string,
  appendSpace = true
): { readonly text: string; readonly caret: number } => {
  const suffix = appendSpace ? " " : ""
  const inserted = `${replacement}${suffix}`
  const nextText =
    text.slice(0, match.rangeStart) + inserted + text.slice(match.rangeEnd)
  return {
    text: nextText,
    caret: match.rangeStart + inserted.length
  }
}

export const TriggerSuggestion = Schema.Struct({
  value: Schema.String,
  label: Schema.String,
  insertText: Schema.optional(Schema.String)
})
export type TriggerSuggestion = typeof TriggerSuggestion.Type

export const TriggerMenuProps = Schema.Struct({
  label: Schema.String,
  text: Schema.String,
  caret: Schema.Number,
  triggers: Schema.optional(Schema.Array(Schema.String)),
  suggestions: Schema.Array(TriggerSuggestion),
  idPrefix: Schema.optional(Schema.String)
})
export type TriggerMenuProps = typeof TriggerMenuProps.Type

export const TriggerMenuEvents = UiSchema.TaggedEnum({
  TextChanged: { text: Schema.String, caret: Schema.Number },
  SuggestionApplied: {
    trigger: Schema.String,
    value: Schema.String,
    text: Schema.String,
    caret: Schema.Number
  }
})
export type TriggerMenuEvents = typeof TriggerMenuEvents.Type

const TriggerMenuMsg = UiSchema.TaggedEnum({
  InputEdited: { value: Schema.String, caret: Schema.Number },
  MovedActive: { index: Schema.Number },
  Dismissed: {},
  PickedSuggestion: { value: Schema.String }
})

/**
 * Caret-triggered inline suggestion input (`@mention`, `/slash`, `#tag`) with
 * fuzzy filtering and keyboard navigation (`ArrowDown`/`ArrowUp`/`Enter`/`Escape`).
 */
export const TriggerMenu = Html.component({
  name: "TriggerMenu",
  props: TriggerMenuProps,
  model: Schema.Struct({
    activeIndex: Schema.Number,
    dismissedAt: Schema.NullOr(Schema.Number)
  }),
  message: TriggerMenuMsg,
  events: TriggerMenuEvents
}).make({
  init: () => ({ activeIndex: 0, dismissedAt: null }),
  update: {
    InputEdited: ($, { caret, value }) =>
      $.evolve({ activeIndex: 0, dismissedAt: null }).emit(
        TriggerMenuEvents.TextChanged({ text: value, caret })
      ),
    MovedActive: ($, { index }) => $.evolve({ activeIndex: index }),
    Dismissed: ($) => $.evolve({ dismissedAt: $.props.caret }),
    PickedSuggestion: ($, { value }) => {
      const match = detectTrigger(
        $.props.text,
        $.props.caret,
        $.props.triggers ?? ["@", "/", "#"]
      )
      if (match === undefined) return $.model
      const item = $.props.suggestions.find((s) => s.value === value)
      if (item === undefined) return $.model
      const replacement = item.insertText ?? `${match.trigger}${item.value}`
      const applied = applyTriggerSelection($.props.text, match, replacement)
      return $.evolve({ activeIndex: 0, dismissedAt: null }).emit(
        TriggerMenuEvents.SuggestionApplied({
          trigger: match.trigger,
          value: item.value,
          text: applied.text,
          caret: applied.caret
        })
      )
    }
  },
  view: (h, model) => {
    const p = h.props
    const prefix = p.idPrefix ?? "trigger"
    const triggers = p.triggers ?? ["@", "/", "#"]
    const match = detectTrigger(p.text, p.caret, triggers)
    const isOpen = match !== undefined && model.dismissedAt !== p.caret
    const filtered = isOpen
      ? fuzzyFilter(p.suggestions, match.query, (s) => `${s.label} ${s.value}`)
      : []
    const clampedIndex =
      filtered.length === 0
        ? -1
        : Math.min(filtered.length - 1, Math.max(0, model.activeIndex))
    const activeItem = clampedIndex >= 0 ? filtered[clampedIndex]!.item : undefined
    const listId = `${prefix}-listbox`

    const showList = isOpen && filtered.length > 0
    return h.div.attrs({ "data-trigger-menu": "" }).children(
      h.input
        .attrs({
          id: `${prefix}-input`,
          type: "text",
          role: "combobox",
          "aria-label": p.label,
          "aria-autocomplete": "list",
          "aria-expanded": String(showList),
          ...(showList ? { "aria-controls": listId } : {}),
          ...(showList && activeItem !== undefined
            ? { "aria-activedescendant": `${prefix}-opt-${safeIdToken(activeItem.value)}` }
            : {})
        })
        .value(p.text)
        .on("input", ({ selectionStart, value }) =>
          TriggerMenuMsg.InputEdited({ value, caret: selectionStart ?? value.length })
        )
        .on(
          "keydown",
          ({ key, composing }) => {
            if (composing) return undefined
            if (!showList) return undefined
            if (key === "ArrowDown") {
              return TriggerMenuMsg.MovedActive({
                index: (clampedIndex + 1) % filtered.length
              })
            }
            if (key === "ArrowUp") {
              return TriggerMenuMsg.MovedActive({
                index: (clampedIndex - 1 + filtered.length) % filtered.length
              })
            }
            if (key === "Enter" && activeItem !== undefined) {
              return TriggerMenuMsg.PickedSuggestion({ value: activeItem.value })
            }
            if (key === "Escape") {
              return TriggerMenuMsg.Dismissed()
            }
            return undefined
          },
          { preventDefault: true }
        ),
      showList
        ? h.ul
            .attrs({ id: listId, role: "listbox", "aria-label": `${p.label} suggestions` })
            .children(
              ...filtered.map(({ item }, idx) =>
                h.li
                  .key(item.value)
                  .attrs({
                    id: `${prefix}-opt-${safeIdToken(item.value)}`,
                    role: "option",
                    "aria-selected": String(idx === clampedIndex)
                  })
                  .on("click", () =>
                    TriggerMenuMsg.PickedSuggestion({ value: item.value })
                  )
                  .children(item.label)
              )
            )
        : undefined
    )
  }
})
