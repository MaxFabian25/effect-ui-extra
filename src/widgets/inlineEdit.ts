import { UiSchema } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import * as Schema from "effect/Schema"

export const InlineEditProps = Schema.Struct({
  label: Schema.String,
  value: Schema.String,
  placeholder: Schema.optional(Schema.String),
  disabled: Schema.optional(Schema.Boolean),
  idPrefix: Schema.optional(Schema.String)
})
export type InlineEditProps = typeof InlineEditProps.Type

export const InlineEditEvents = UiSchema.TaggedEnum({
  Committed: { value: Schema.String },
  Cancelled: {}
})
export type InlineEditEvents = typeof InlineEditEvents.Type

const InlineEditMsg = UiSchema.TaggedEnum({
  Started: {},
  DraftChanged: { value: Schema.String },
  Confirmed: { restoreFocus: Schema.Boolean },
  Reverted: {},
  FocusDone: {}
})

const triggerRef = Html.ref("InlineEditTrigger", "button")
const inputRef = Html.ref("InlineEditInput", "input")

/**
 * Inline editable text control: click, Enter, or F2 starts editing; Enter or
 * blur commits; Escape reverts and restores focus to the display button.
 */
export const InlineEdit = Html.component({
  name: "InlineEdit",
  props: InlineEditProps,
  model: Schema.Struct({
    editing: Schema.Boolean,
    draft: Schema.String
  }),
  message: InlineEditMsg,
  events: InlineEditEvents
}).make({
  init: ($) => ({ editing: false, draft: $.props.value }),
  update: {
    Started: ($) => {
      if ($.props.disabled) return $.model
      return $.evolve({ editing: true, draft: $.props.value }).run(
        HtmlCommand.focus(inputRef, () => InlineEditMsg.FocusDone())
      )
    },
    DraftChanged: ($, { value }) => $.evolve({ draft: value }),
    Confirmed: ($, { restoreFocus }) => {
      if (!$.model.editing) return $.model
      const next = $.model.draft.trim()
      const evolved = $.evolve({ editing: false })
      const withFocus = restoreFocus
        ? evolved.run(HtmlCommand.focus(triggerRef, () => InlineEditMsg.FocusDone()))
        : evolved
      return next !== $.props.value
        ? withFocus.emit(InlineEditEvents.Committed({ value: next }))
        : withFocus
    },
    Reverted: ($) => {
      if (!$.model.editing) return $.model
      return $.evolve({ editing: false, draft: $.props.value })
        .emit(InlineEditEvents.Cancelled())
        .run(HtmlCommand.focus(triggerRef, () => InlineEditMsg.FocusDone()))
    },
    FocusDone: ($) => $.model
  },
  view: (h, model) => {
    const p = h.props
    const prefix = p.idPrefix ?? "inline-edit"

    if (model.editing) {
      return h.span.attrs({ "data-inline-edit": "editing" }).children(
        h.input
          .ref(inputRef)
          .attrs({
            id: `${prefix}-input`,
            type: "text",
            "aria-label": p.label,
            placeholder: p.placeholder
          })
          .value(model.draft)
          .on("input", ({ value }) => InlineEditMsg.DraftChanged({ value }))
          .on("blur", () => InlineEditMsg.Confirmed({ restoreFocus: false }))
          .on(
            "keydown",
            ({ key, composing }) => {
              if (composing) return undefined
              if (key === "Enter") return InlineEditMsg.Confirmed({ restoreFocus: true })
              if (key === "Escape") return InlineEditMsg.Reverted()
              return undefined
            },
            { preventDefault: true }
          )
      )
    }

    const displayText = p.value || p.placeholder || "Edit"
    return h.button
      .ref(triggerRef)
      .attrs({
        id: `${prefix}-trigger`,
        type: "button",
        "data-inline-edit": "viewing",
        "aria-label": `${p.label}: ${displayText}`
      })
      .disabled(p.disabled ?? false)
      .on("click", () => InlineEditMsg.Started())
      .on("keydown", ({ key }) =>
        key === "F2" ? InlineEditMsg.Started() : undefined
      )
      .children(displayText)
  }
})
