import { UiSchema } from '@effect/ui';
import type { View } from '@effect/ui';
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { fuzzyFilter } from './fuzzy.js';
import type { FuzzyRange } from './fuzzy.js';
import { safeIdToken } from "./internal.js"

export const CommandItem = Schema.Struct({
  value: Schema.String,
  label: Schema.String,
  group: Schema.optional(Schema.String),
  keywords: Schema.optional(Schema.Array(Schema.String)),
  shortcut: Schema.optional(Schema.String),
  disabled: Schema.optional(Schema.Boolean)
})
export type CommandItem = typeof CommandItem.Type

export const CommandProps = Schema.Struct({
  open: Schema.Boolean,
  label: Schema.String,
  items: Schema.Array(CommandItem),
  placeholder: Schema.optional(Schema.String),
  emptyText: Schema.optional(Schema.String),
  idPrefix: Schema.optional(Schema.String)
})
export type CommandProps = typeof CommandProps.Type

export const CommandEvents = UiSchema.TaggedEnum({
  Selected: { value: Schema.String },
  RequestedOpen: {},
  RequestedClose: {}
})
export type CommandEvents = typeof CommandEvents.Type

const CommandMsg = UiSchema.TaggedEnum({
  TypedQuery: { query: Schema.String },
  Highlighted: { value: Schema.String },
  Executed: { value: Schema.String },
  PressedOpen: {},
  PressedClose: {}
})

const renderHighlighted = (
  h: Html.H<typeof CommandMsg.Type>,
  text: string,
  ranges: ReadonlyArray<FuzzyRange>
): ReadonlyArray<View.Content<typeof CommandMsg.Type>> => {
  if (ranges.length === 0) return [h.text(text)]
  const out: Array<View.Content<typeof CommandMsg.Type>> = []
  let cursor = 0
  for (const r of ranges) {
    if (r.start > cursor) {
      out.push(h.text(text.slice(cursor, r.start)))
    }
    out.push(h.mark(text.slice(r.start, r.end)))
    cursor = r.end
  }
  if (cursor < text.length) {
    out.push(h.text(text.slice(cursor)))
  }
  return out
}

/**
 * Accessible WAI-ARIA Combobox-pattern Command Palette powered by
 * accent-insensitive `fuzzyFilter`, match-range `<mark>` highlighting,
 * grouped sections, `aria-activedescendant`, and full keyboard navigation
 * (`ArrowDown`, `ArrowUp`, `Home`, `End`, `Enter`, `Escape`).
 */
export const Command = Html.component({
  name: "Command",
  props: CommandProps,
  model: Schema.Struct({
    query: Schema.String,
    activeValue: Schema.NullOr(Schema.String)
  }),
  message: CommandMsg,
  events: CommandEvents
}).make({
  init: ($) => {
    const first = $.props.items.find((i) => !i.disabled)?.value ?? null
    return { query: "", activeValue: first }
  },
  update: {
    TypedQuery: ($, { query }) => {
      const matches = fuzzyFilter(
        $.props.items,
        query,
        (i) => i.label,
        (i) => i.keywords
      )
      const firstEnabled = matches.find((m) => !m.item.disabled)?.item.value ?? null
      return $.evolve({ query, activeValue: firstEnabled })
    },
    Highlighted: ($, { value }) => $.evolve({ activeValue: value }),
    Executed: ($, { value }) =>
      $.emit(CommandEvents.Selected({ value })).emit(
        CommandEvents.RequestedClose()
      ),
    PressedOpen: ($) => $.emit(CommandEvents.RequestedOpen()),
    PressedClose: ($) => $.emit(CommandEvents.RequestedClose())
  },
  view: (h, model) => {
    const p = h.props
    const prefix = p.idPrefix ?? "command"
    const listId = `${prefix}-listbox`
    const matches = fuzzyFilter(
      p.items,
      model.query,
      (i) => i.label,
      (i) => i.keywords
    )
    // Group matches preserving relevance order of first appearance
    const grouped = new Map<string, Array<(typeof matches)[number]>>()
    for (const m of matches) {
      const g = m.item.group ?? ""
      const list = grouped.get(g) ?? []
      list.push(m)
      grouped.set(g, list)
    }

    const orderedMatches = Array.from(grouped.values()).flat()
    const enabledMatches = orderedMatches.filter((m) => !m.item.disabled)
    const active =
      enabledMatches.find((m) => m.item.value === model.activeValue)?.item.value ??
      enabledMatches[0]?.item.value ??
      null
    const activeOptionId =
      active !== null ? `${prefix}-opt-${safeIdToken(active)}` : undefined

    const renderOption = (m: (typeof matches)[number]) => {
      const isHighlighted = !m.item.disabled && active === m.item.value
      return h.div
        .key(m.item.value)
        .attrs({
          id: `${prefix}-opt-${safeIdToken(m.item.value)}`,
          role: "option",
          "aria-selected": String(isHighlighted),
          ...(m.item.disabled
            ? { "aria-disabled": "true", "data-disabled": "" }
            : {}),
          ...(isHighlighted ? { "data-highlighted": "" } : {})
        })
        .on("click", () =>
          m.item.disabled
            ? undefined
            : CommandMsg.Executed({ value: m.item.value })
        )
        .children(
          h.span.children(...renderHighlighted(h, m.item.label, m.match.ranges)),
          m.item.shortcut !== undefined
            ? h.kbd.attrs({ "aria-hidden": "true" }).children(m.item.shortcut)
            : undefined
        )
    }

    return h.div.attrs({ "data-command": "" }).children(
      h.input
        .attrs({
          type: "text",
          role: "combobox",
          "aria-label": p.label,
          "aria-expanded": String(p.open),
          "aria-autocomplete": "list",
          "aria-haspopup": "listbox",
          autocomplete: "off",
          autocapitalize: "none",
          autocorrect: "off",
          spellcheck: "false",
          ...(p.open ? { "aria-controls": listId } : {}),
          ...(p.open && activeOptionId !== undefined
            ? { "aria-activedescendant": activeOptionId }
            : {}),
          ...(p.placeholder !== undefined ? { placeholder: p.placeholder } : {})
        })
        .value(model.query)
        .on("input", ({ value }) => CommandMsg.TypedQuery({ query: value }))
        .on(
          "keydown",
          ({ key, composing }) => {
            if (composing) return undefined
            if (!p.open) {
              if (key === "ArrowDown" || key === "ArrowUp") {
                return CommandMsg.PressedOpen()
              }
              return undefined
            }
            if (key === "Escape") {
              return CommandMsg.PressedClose()
            }
            const firstMatch = enabledMatches[0]
            const lastMatch = enabledMatches[enabledMatches.length - 1]
            if (firstMatch === undefined || lastMatch === undefined) return undefined
            const idx = enabledMatches.findIndex((m) => m.item.value === active)
            if (key === "ArrowDown") {
              const next =
                enabledMatches[(idx + 1 + enabledMatches.length) % enabledMatches.length] ??
                firstMatch
              return CommandMsg.Highlighted({ value: next.item.value })
            }
            if (key === "ArrowUp") {
              const prev =
                enabledMatches[(idx - 1 + enabledMatches.length) % enabledMatches.length] ??
                lastMatch
              return CommandMsg.Highlighted({ value: prev.item.value })
            }
            if (key === "Home") {
              return CommandMsg.Highlighted({ value: firstMatch.item.value })
            }
            if (key === "End") {
              return CommandMsg.Highlighted({
                value: lastMatch.item.value
              })
            }
            if (key === "Enter" && active !== null) {
              return CommandMsg.Executed({ value: active })
            }
            return undefined
          },
          { preventDefault: true }
        ),
      p.open
        ? h.div
            .attrs({ id: listId, role: "listbox", "aria-label": p.label })
            .children(
              ...(matches.length === 0
                ? [
                    h.div
                      .attrs({ role: "status", "data-command-empty": "" })
                      .children(p.emptyText ?? "No matching commands")
                  ]
                : Array.from(grouped.entries()).flatMap(([groupName, entries], gi) => {
                    if (groupName === "") {
                      return entries.map(renderOption)
                    }
                    const headingId = `${prefix}-group-${gi}`
                    return [
                      h.div
                        .key(`group-${groupName}`)
                        .attrs({ role: "group", "aria-labelledby": headingId })
                        .children(
                          h.div.attrs({ id: headingId, "data-command-group-heading": "" }).children(groupName),
                          ...entries.map(renderOption)
                        )
                    ]
                  }))
            )
        : undefined
    )
  }
})
