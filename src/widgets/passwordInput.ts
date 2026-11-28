import { UiSchema } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"

export const PasswordInputProps = Schema.Struct({
  value: Schema.RedactedFromValue(Schema.String),
  id: Schema.String,
  label: Schema.String,
  name: Schema.optional(Schema.String),
  placeholder: Schema.optional(Schema.String),
  autocomplete: Schema.optional(
    Schema.Literals(["current-password", "new-password", "off"])
  ),
  disabled: Schema.optional(Schema.Boolean),
  readOnly: Schema.optional(Schema.Boolean),
  required: Schema.optional(Schema.Boolean),
  invalid: Schema.optional(Schema.Boolean),
  describedBy: Schema.optional(Schema.String),
  showLabel: Schema.optional(Schema.String),
  hideLabel: Schema.optional(Schema.String),
  showText: Schema.optional(Schema.String),
  hideText: Schema.optional(Schema.String)
})
export type PasswordInputProps = typeof PasswordInputProps.Type

export const PasswordInputEvents = UiSchema.TaggedEnum({
  Changed: { value: Schema.RedactedFromValue(Schema.String) },
  ToggledVisibility: { revealed: Schema.Boolean }
})
export type PasswordInputEvents = typeof PasswordInputEvents.Type

const PasswordMsg = UiSchema.TaggedEnum({
  Typed: { value: Schema.String },
  Toggled: {},
  FocusDone: {}
})

const inputRef = Html.ref("PasswordInputField", "input")

/**
 * Accessible password input backed by `Schema.Redacted`.
 *
 * The component's own `Model` stores only `{ revealed: boolean }` so the
 * password value is never serialized into SSR state JSON.
 */
export const PasswordInput = Html.component({
  name: "PasswordInput",
  props: PasswordInputProps,
  model: Schema.Struct({ revealed: Schema.Boolean }),
  message: PasswordMsg,
  events: PasswordInputEvents
}).make({
  init: () => ({ revealed: false }),
  update: {
    Typed: ($, { value }) =>
      $.emit(PasswordInputEvents.Changed({ value: Redacted.make(value) })),
    Toggled: ($) => {
      if ($.props.disabled) return $.model
      const next = !$.model.revealed
      return $.evolve({ revealed: next })
        .emit(PasswordInputEvents.ToggledVisibility({ revealed: next }))
        .run(HtmlCommand.focus(inputRef, () => PasswordMsg.FocusDone()))
    },
    FocusDone: ($) => $.model
  },
  view: (h, model) => {
    const p = h.props
    const rawValue = Redacted.value(p.value)
    const toggleLabel = model.revealed
      ? (p.hideLabel ?? "Hide password")
      : (p.showLabel ?? "Show password")
    const toggleText = model.revealed
      ? (p.hideText ?? (p.hideLabel !== undefined ? p.hideLabel : "Hide"))
      : (p.showText ?? (p.showLabel !== undefined ? p.showLabel : "Show"))
    return h.div
      .attrs({
        "data-password-input": "",
        ...(model.revealed ? { "data-revealed": "" } : { "data-masked": "" }),
        ...(p.disabled ? { "data-disabled": "" } : {})
      })
      .children(
        h.label.attrs({ for: p.id }).children(p.label),
        h.div.attrs({ "data-password-control": "" }).children(
          h.input
            .ref(inputRef)
            .attrs({
              id: p.id,
              type: model.revealed ? "text" : "password",
              autocomplete: p.autocomplete ?? "current-password",
              autocapitalize: "none",
              autocorrect: "off",
              spellcheck: "false",
              ...(p.name !== undefined ? { name: p.name } : {}),
              ...(p.placeholder !== undefined ? { placeholder: p.placeholder } : {}),
              ...(p.disabled ? { disabled: "" } : {}),
              ...(p.readOnly ? { readonly: "" } : {}),
              ...(p.required ? { required: "" } : {}),
              ...(p.invalid ? { "aria-invalid": "true" } : {}),
              ...(p.describedBy !== undefined ? { "aria-describedby": p.describedBy } : {})
            })
            .value(rawValue)
            .on("input", ({ value }) => PasswordMsg.Typed({ value })),
          h.button
            .attrs({
              type: "button",
              "aria-label": toggleLabel,
              "aria-controls": p.id,
              ...(p.disabled ? { disabled: "" } : {})
            })
            .on("click", PasswordMsg.Toggled())
            .children(toggleText)
        )
      )
  }
})
