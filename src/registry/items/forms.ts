import type { RegistryItem } from "../schema.js"

/**
 * 15 styled form control blueprints completing shadcn form parity for Effect UI:
 * `input`, `textarea`, `label`, `field`, `checkbox`, `switch`, `radio-group`,
 * `select`, `native-select`, `combobox`, `input-otp`, `slider`, `calendar`,
 * `toggle`, `toggle-group`.
 */
export const FORM_REGISTRY_ITEMS: ReadonlyArray<RegistryItem> = [
  {
    name: "input",
    title: "Input",
    category: "primitives",
    description: "Styled text input with focus ring, error state, and disabled styling.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "input.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const inputClass = (className?: string): string =>
  cn(
    "flex min-h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-base md:text-sm text-foreground transition-colors",
    "placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
    "aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
    className
  )

export const styledInput = <Msg>(
  h: Html.H<Msg>,
  options?: {
    readonly id?: string | undefined
    readonly name?: string | undefined
    readonly type?: string | undefined
    readonly placeholder?: string | undefined
    readonly autocomplete?: string | undefined
    readonly inputmode?: string | undefined
    readonly enterkeyhint?: string | undefined
    readonly spellcheck?: "true" | "false" | undefined
    readonly required?: boolean | undefined
    readonly describedBy?: string | undefined
    readonly invalid?: boolean | undefined
    readonly disabled?: boolean | undefined
    readonly className?: string | undefined
  }
) =>
  h.input.class(inputClass(options?.className)).attrs({
    type: options?.type ?? "text",
    ...(options?.id !== undefined ? { id: options.id } : {}),
    ...(options?.name !== undefined ? { name: options.name } : {}),
    ...(options?.placeholder !== undefined ? { placeholder: options.placeholder } : {}),
    ...(options?.autocomplete !== undefined ? { autocomplete: options.autocomplete } : {}),
    ...(options?.inputmode !== undefined ? { inputmode: options.inputmode } : {}),
    ...(options?.enterkeyhint !== undefined ? { enterkeyhint: options.enterkeyhint } : {}),
    ...(options?.spellcheck !== undefined ? { spellcheck: options.spellcheck } : {}),
    ...(options?.required === true ? { required: "" } : {}),
    ...(options?.describedBy !== undefined ? { "aria-describedby": options.describedBy } : {}),
    ...(options?.invalid === true ? { "aria-invalid": "true" } : {}),
    ...(options?.disabled === true ? { disabled: "" } : {})
  })
`
      }
    ]
  },
  {
    name: "textarea",
    title: "Textarea",
    category: "primitives",
    description: "Styled multiline textarea with field-sizing support and focus ring.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "textarea.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const textareaClass = (className?: string): string =>
  cn(
    "flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm text-foreground",
    "placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
    "aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
    className
  )

export const styledTextarea = <Msg>(
  h: Html.H<Msg>,
  options?: {
    readonly id?: string | undefined
    readonly name?: string | undefined
    readonly rows?: number | undefined
    readonly placeholder?: string | undefined
    readonly invalid?: boolean | undefined
    readonly disabled?: boolean | undefined
    readonly className?: string | undefined
  }
) =>
  h.textarea.class(textareaClass(options?.className)).attrs({
    ...(options?.id !== undefined ? { id: options.id } : {}),
    ...(options?.name !== undefined ? { name: options.name } : {}),
    ...(options?.rows !== undefined ? { rows: String(options.rows) } : {}),
    ...(options?.placeholder !== undefined ? { placeholder: options.placeholder } : {}),
    ...(options?.invalid === true ? { "aria-invalid": "true" } : {}),
    ...(options?.disabled === true ? { disabled: "" } : {})
  })
`
      }
    ]
  },
  {
    name: "label",
    title: "Label",
    category: "primitives",
    description: "Styled accessible form control label.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "label.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const labelClass = (className?: string): string =>
  cn("text-sm font-medium leading-snug text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-60", className)

export const styledLabel = <Msg>(
  h: Html.H<Msg>,
  text: string,
  options?: { readonly htmlFor?: string | undefined; readonly className?: string | undefined }
) =>
  h.label
    .class(labelClass(options?.className))
    .attrs(options?.htmlFor !== undefined ? { for: options.htmlFor } : {})
    .children(text)
`
      }
    ]
  },
  {
    name: "field",
    title: "Field",
    category: "primitives",
    description: "Styled form field layout combining label, control slot, helper description, and error alert.",
    registryDependencies: ["cn", "label"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "field.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"
import { styledLabel } from "./label.js"

export const styledField = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly id: string
    readonly label: string
    readonly control: View.Content<Msg>
    readonly description?: string | undefined
    readonly error?: string | null | undefined
    readonly className?: string | undefined
  }
) =>
  h.div
    .attrs({ "data-field": "", ...(options.error ? { "data-invalid": "" } : {}) })
    .class(cn("flex flex-col gap-1.5", options.className))
    .children(
      styledLabel(h, options.label, { htmlFor: options.id }),
      options.control,
      ...(options.description !== undefined
        ? [h.p.attrs({ id: \`\${options.id}-desc\` }).class("text-xs text-muted-foreground").children(options.description)]
        : []),
      ...(options.error != null && options.error.length > 0
        ? [h.p.attrs({ id: \`\${options.id}-err\`, "aria-live": "polite" }).class("text-xs font-medium text-destructive").children(options.error)]
        : [])
    )
`
      }
    ]
  },
  {
    name: "checkbox",
    title: "Checkbox",
    category: "primitives",
    description: "Styled checkbox classes and indicator helpers for @effect/ui-kit Checkbox.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "checkbox.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const checkboxClass = (className?: string): string =>
  cn(
    "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border border-input bg-background text-primary-foreground transition-colors touch-manipulation before:absolute before:-inset-2.5",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "data-[checked]:border-primary data-[checked]:bg-primary data-[indeterminate]:border-primary data-[indeterminate]:bg-primary",
    "disabled:cursor-not-allowed disabled:opacity-50",
    className
  )

export const styledCheckboxRow = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly id: string
    readonly label: string
    readonly checked: boolean
    readonly onChange: Msg
    readonly disabled?: boolean | undefined
    readonly className?: string | undefined
  }
) =>
  h.label
    .attrs({ for: options.id })
    .class(cn("inline-flex min-h-8 cursor-pointer items-center gap-2.5 text-sm text-foreground", options.className))
    .children(
      h.input
        .attrs({
          id: options.id,
          type: "checkbox",
          ...(options.checked ? { checked: "" } : {}),
          ...(options.disabled === true ? { disabled: "" } : {})
        })
        .class("h-6 w-6 min-h-6 min-w-6 rounded-xs border border-input accent-primary")
        .on("change", () => options.onChange),
      h.span.children(options.label)
    )
`
      }
    ]
  },
  {
    name: "switch",
    title: "Switch",
    category: "primitives",
    description: "Styled toggle switch track and thumb classes for @effect/ui-kit Switch.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "switch.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const switchTrackClass = (className?: string): string =>
  cn(
    "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-input bg-muted p-0.5 transition-colors touch-manipulation before:absolute before:-inset-y-2 before:-inset-x-1",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "data-[checked]:border-primary data-[checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
    className
  )

export const switchThumbClass = (className?: string): string =>
  cn(
    "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm transition-transform duration-150 ease-[var(--ease-eui,ease-out)] motion-reduce:transition-none",
    "data-[checked]:translate-x-4 rtl:data-[checked]:-translate-x-4",
    className
  )

export const styledSwitch = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly label: string
    readonly checked: boolean
    readonly onToggle: Msg
    readonly disabled?: boolean | undefined
    readonly className?: string | undefined
  }
) =>
  h.button
    .attrs({
      type: "button",
      role: "switch",
      "aria-checked": String(options.checked),
      "aria-label": options.label,
      ...(options.checked ? { "data-checked": "" } : {}),
      ...(options.disabled === true ? { disabled: "" } : {})
    })
    .class(switchTrackClass(options.className))
    .on("click", () => options.onToggle)
    .children(
      h.span
        .attrs(options.checked ? { "data-checked": "" } : {})
        .class(switchThumbClass())
    )
`
      }
    ]
  },
  {
    name: "radio-group",
    title: "Radio Group",
    category: "primitives",
    description: "Styled radio group item classes and accessible option list helper.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "radioGroup.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export interface RadioChoice {
  readonly value: string
  readonly label: string
  readonly description?: string | undefined
}

export const radioItemClass = (className?: string): string =>
  cn(
    "flex min-h-10 items-start gap-2.5 rounded-md border border-border bg-background px-3 py-2 text-start text-sm touch-manipulation transition-colors",
    "hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "data-[checked]:border-primary data-[checked]:bg-accent/40",
    className
  )

export const styledRadioGroup = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly label: string
    readonly value: string
    readonly choices: ReadonlyArray<RadioChoice>
    readonly onSelect: (value: string) => Msg
    readonly className?: string | undefined
  }
) => {
  const activeIdx = Math.max(0, options.choices.findIndex((c) => c.value === options.value))
  return h.div
    .attrs({ role: "radiogroup", "aria-label": options.label })
    .class(cn("flex flex-col gap-2", options.className))
    .children(
      ...options.choices.map((c, idx) => {
        const checked = c.value === options.value
        const tabbable = checked || idx === activeIdx
        return h.button
          .key(c.value)
          .attrs({
            type: "button",
            role: "radio",
            "aria-checked": String(checked),
            tabindex: tabbable ? "0" : "-1",
            ...(checked ? { "data-checked": "" } : {})
          })
          .class(radioItemClass())
          .on("click", () => options.onSelect(c.value))
          .on(
            "keydown",
            ({ key }) => {
              if (options.choices.length === 0) return undefined
              if (key === "ArrowDown" || key === "ArrowRight") {
                const next = options.choices[(idx + 1) % options.choices.length]!
                return options.onSelect(next.value)
              }
              if (key === "ArrowUp" || key === "ArrowLeft") {
                const prev = options.choices[(idx - 1 + options.choices.length) % options.choices.length]!
                return options.onSelect(prev.value)
              }
              return undefined
            },
            { preventDefault: true }
          )
          .children(
            h.span
              .attrs({ "aria-hidden": "true" })
              .class(cn("mt-0.5 h-4 w-4 shrink-0 rounded-full border", checked ? "border-4 border-primary" : "border-input")),
            h.span.class("flex flex-col").children(
              h.span.class("font-medium text-foreground").children(c.label),
              ...(c.description !== undefined
                ? [h.span.class("text-xs text-muted-foreground").children(c.description)]
                : [])
            )
          )
      })
    )
}
`
      }
    ]
  },
  {
    name: "select",
    title: "Select",
    category: "primitives",
    description: "Styled dropdown select wrapping @effect/ui-kit Select with trigger, popup, and check indicator.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "select.ts",
        content: `import type { Html } from "@effect/ui/html"
import { Select } from "@effect/ui-kit"
import { cn } from "./cn.js"
import { uiIcon } from "./icons.js"

export const selectTriggerClass = (className?: string): string =>
  cn(
    "inline-flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground touch-manipulation select-none",
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-50",
    className
  )

export const selectPopupClass = (className?: string): string =>
  cn(
    "z-[var(--z-dropdown,100)] min-w-36 overflow-auto overscroll-contain rounded-md border border-border bg-surface p-1 text-foreground shadow-md dark:shadow-none",
    "origin-[var(--transform-origin)] transition-[transform,opacity] duration-150 ease-[var(--ease-eui,ease-out)] data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.96] data-[ending-style]:opacity-0 data-[ending-style]:duration-100 motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100",
    className
  )

export const selectItemClass = (className?: string): string =>
  cn(
    "flex min-h-8 cursor-pointer select-none items-center justify-between gap-2 rounded-xs px-2.5 py-1.5 text-sm outline-none",
    "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[highlighted]:ring-2 data-[highlighted]:ring-inset data-[highlighted]:ring-ring data-[disabled]:opacity-50",
    className
  )

export interface StyledSelectOption {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean | undefined
}

export const styledSelect = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly open: boolean
    readonly value: string | null
    readonly label?: string | undefined
    readonly placeholder?: string | undefined
    readonly items: ReadonlyArray<StyledSelectOption>
    readonly onOpenChange: (open: boolean) => Msg
    readonly onSelect: (value: string | null) => Msg
    readonly className?: string | undefined
  }
) =>
  Select(h, {
    key: options.key ?? "select",
    props: {
      open: options.open,
      value: options.value,
      items: options.items
    },
    onEmit: {
      RequestedOpen: () => options.onOpenChange(true),
      RequestedClose: () => options.onOpenChange(false),
      Settled: () => undefined,
      Picked: ({ value }) => options.onSelect(typeof value === "string" ? value : null)
    },
    view: (parts) =>
      h.div.class(cn("relative w-full", options.className)).children(
        parts.trigger(
          h.button
            .attrs({
              type: "button",
              ...(options.label !== undefined ? { "aria-label": options.label } : {})
            })
            .class(selectTriggerClass())
        ).children(
          parts.value(h.span).children(
            options.items.find((i) => i.value === options.value)?.label ?? options.placeholder ?? "Select…"
          ),
          parts.icon(h.span.attrs({ "aria-hidden": "true" }).class("shrink-0 text-muted-foreground")).children(
            uiIcon(h, "chevronDown", 14)
          )
        ),
        parts.positioner(h.div).children(
          parts.popup(h.div.class(selectPopupClass())).children(
            parts.list(h.div).children(
              ...options.items.map((item) =>
                parts.item({ element: h.div.key(item.value).class(selectItemClass()), value: item.value }).children(
                  parts.itemText(h.div).children(item.label),
                  parts.itemIndicator({ element: h.span.attrs({ "aria-hidden": "true" }).class("shrink-0"), value: item.value })?.children(
                    uiIcon(h, "check", 14)
                  )
                )
              )
            )
          )
        )
      )
  })
`
      }
    ]
  },
  {
    name: "native-select",
    title: "Native Select",
    category: "primitives",
    description: "Styled native HTML select dropdown bound to theme input tokens.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "nativeSelect.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export interface NativeSelectOption {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean | undefined
}

export const styledNativeSelect = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly id?: string | undefined
    readonly label: string
    readonly value: string
    readonly items: ReadonlyArray<NativeSelectOption>
    readonly onChange: (value: string) => Msg
    readonly disabled?: boolean | undefined
    readonly className?: string | undefined
  }
) =>
  h.select
    .attrs({
      ...(options.id !== undefined ? { id: options.id } : {}),
      "aria-label": options.label,
      ...(options.disabled === true ? { disabled: "" } : {})
    })
    .class(
      cn(
        "min-h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-base md:text-sm text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-50",
        options.className
      )
    )
    .value(options.value)
    .on("change", ({ value }) => options.onChange(value))
    .children(
      ...options.items.map((item) =>
        h.option
          .key(item.value)
          .attrs({
            value: item.value,
            ...(item.disabled === true ? { disabled: "" } : {})
          })
          .children(item.label)
      )
    )
`
      }
    ]
  },
  {
    name: "combobox",
    title: "Combobox",
    category: "primitives",
    description: "Styled searchable combobox wrapping @effect/ui-kit Combobox with input, popup, and empty state.",
    registryDependencies: ["cn", "input", "select"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "combobox.ts",
        content: `import type { Html } from "@effect/ui/html"
import { Combobox } from "@effect/ui-kit"
import { cn } from "./cn.js"
import { uiIcon } from "./icons.js"
import { inputClass } from "./input.js"
import { selectItemClass, selectPopupClass } from "./select.js"

export const comboboxInputClass = (className?: string): string => inputClass(className)

export const comboboxChipsClass = (className?: string): string =>
  cn(
    "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-base md:text-sm",
    "focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ring",
    className
  )

export const comboboxChipClass = (className?: string): string =>
  cn("inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-foreground", className)

export const comboboxPopupClass = (className?: string): string => selectPopupClass(className)

export const comboboxItemClass = (className?: string): string => selectItemClass(className)

export interface StyledComboboxOption {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean | undefined
}

export const styledCombobox = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly open: boolean
    readonly value: string | null
    readonly inputValue: string
    readonly label?: string | undefined
    readonly placeholder?: string | undefined
    readonly emptyText?: string | undefined
    readonly items: ReadonlyArray<StyledComboboxOption>
    readonly onOpenChange: (open: boolean) => Msg
    readonly onInputValueChange: (value: string) => Msg
    readonly onSelect: (value: string | null) => Msg
    readonly className?: string | undefined
  }
) =>
  Combobox(h, {
    key: options.key ?? "combobox",
    props: {
      open: options.open,
      value: options.value,
      inputValue: options.inputValue,
      items: options.items
    },
    onEmit: {
      RequestedOpen: () => options.onOpenChange(true),
      RequestedClose: () => options.onOpenChange(false),
      RequestedInputValue: ({ inputValue }) => options.onInputValueChange(inputValue),
      Picked: ({ value }) => options.onSelect(typeof value === "string" ? value : null),
      Highlighted: () => undefined,
      Settled: () => undefined
    },
    view: (parts) =>
      h.div.class(cn("relative w-full", options.className)).children(
        parts.inputGroup(h.div.class("relative flex items-center")).children(
          parts.input(
            h.input.attrs({
              type: "text",
              autocomplete: "off",
              spellcheck: "false",
              enterkeyhint: "search",
              ...(options.label !== undefined ? { "aria-label": options.label } : {}),
              ...(options.placeholder !== undefined ? { placeholder: options.placeholder } : {})
            }).class(comboboxInputClass("pe-10"))
          ),
          parts.trigger(
            h.button
              .attrs({ type: "button", "aria-label": "Toggle options" })
              .class("absolute end-0 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground touch-manipulation hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring")
          ).children(uiIcon(h, "chevronDown", 14))
        ),
        parts.positioner(h.div).children(
          parts.popup(h.div.class(comboboxPopupClass())).children(
            parts.list(h.div).children(
              ...parts.items.map((item) =>
                parts.item({ element: h.div.key(item.value).class(comboboxItemClass()), value: item.value }).children(
                  h.span.children(item.label),
                  parts.itemIndicator({ element: h.span.attrs({ "aria-hidden": "true" }).class("shrink-0"), value: item.value })?.children(
                    uiIcon(h, "check", 14)
                  )
                )
              )
            ),
            parts.empty(h.div.class("px-2.5 py-2 text-xs text-muted-foreground")).children(options.emptyText ?? "No matches")
          )
        )
      )
  })
`
      }
    ]
  },
  {
    name: "input-otp",
    title: "Input OTP",
    category: "primitives",
    description: "Styled segmented one-time passcode input wrapping @effect/ui-kit OTPField with Redacted state.",
    registryDependencies: ["cn"],
    dependencies: ["effect", "@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "inputOtp.ts",
        content: `import type { Html } from "@effect/ui/html"
import { OTPField } from "@effect/ui-kit"
import type * as Redacted from "effect/Redacted"
import { cn } from "./cn.js"

export const otpGroupClass = (className?: string): string =>
  cn("inline-flex max-w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2", className)

export const otpSlotClass = (className?: string): string =>
  cn(
    "flex h-10 w-9 sm:w-10 items-center justify-center rounded-md border border-input bg-background text-center font-mono text-base font-semibold tabular-nums text-foreground",
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring data-[invalid]:border-destructive",
    className
  )

export const styledInputOtp = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly value: Redacted.Redacted<string>
    readonly length?: number | undefined
    readonly onUpdate: (value: Redacted.Redacted<string>) => Msg
    readonly onComplete?: ((value: Redacted.Redacted<string>) => Msg) | undefined
    readonly className?: string | undefined
  }
) => {
  const length = Math.max(1, options.length ?? 6)
  return OTPField(h, {
    key: options.key ?? "input-otp",
    props: { value: options.value, length },
    onEmit: {
      Updated: ({ value }) => options.onUpdate(value),
      Completed: ({ value }) => (options.onComplete ? options.onComplete(value) : undefined),
      Rejected: () => undefined
    },
    view: (parts) =>
      parts.root(h.div.class(otpGroupClass(options.className))).children(
        ...Array.from({ length }, (_, index) =>
          parts.input({
            element: h.input
              .key(String(index))
              .attrs({
                "aria-label": \`Digit \${index + 1}\`,
                inputmode: "numeric",
                autocomplete: index === 0 ? "one-time-code" : "off"
              })
              .class(otpSlotClass()),
            index
          })
        )
      )
  })
}
`
      }
    ]
  },
  {
    name: "slider",
    title: "Slider",
    category: "primitives",
    description: "Styled range slider wrapping @effect/ui-kit Slider with track, indicator, and accessible thumb.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "slider.ts",
        content: `import type { Html } from "@effect/ui/html"
import { Slider } from "@effect/ui-kit"
import { cn } from "./cn.js"

export const sliderRootClass = (className?: string): string =>
  cn("relative flex w-full touch-none select-none items-center py-2", className)

export const sliderTrackClass = (className?: string): string =>
  cn("relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted", className)

export const sliderIndicatorClass = (className?: string): string =>
  cn("absolute h-full bg-primary", className)

export const sliderThumbClass = (className?: string): string =>
  cn(
    "relative block h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm transition-transform duration-150 motion-reduce:transition-none before:absolute before:-inset-3",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[dragging]:scale-110 motion-reduce:data-[dragging]:scale-100",
    className
  )

export const styledSlider = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly label: string
    readonly value: number
    readonly min?: number | undefined
    readonly max?: number | undefined
    readonly step?: number | undefined
    readonly onMove: (value: number) => Msg
    readonly onCommit?: ((value: number) => Msg) | undefined
    readonly className?: string | undefined
  }
) =>
  Slider(h, {
    key: options.key ?? "slider",
    props: {
      value: options.value,
      ...(options.min !== undefined ? { min: options.min } : {}),
      ...(options.max !== undefined ? { max: options.max } : {}),
      ...(options.step !== undefined ? { step: options.step } : {})
    },
    onEmit: {
      Moved: ({ value }) => options.onMove(typeof value === "number" ? value : (value[0] ?? 0)),
      Committed: ({ value }) =>
        options.onCommit ? options.onCommit(typeof value === "number" ? value : (value[0] ?? 0)) : undefined
    },
    view: (parts) =>
      parts.root(h.div.class(sliderRootClass(options.className))).children(
        parts.control(h.div.class("relative flex w-full items-center")).children(
          parts.track(h.div.class(sliderTrackClass())).children(
            parts.indicator(h.div.class(sliderIndicatorClass())),
            parts.thumb({
              element: h.div.class(sliderThumbClass()),
              input: h.input.attrs({ "aria-label": options.label }),
              index: 0
            })
          )
        )
      )
  })
`
      }
    ]
  },
  {
    name: "calendar",
    title: "Calendar",
    category: "data",
    description: "Styled interactive month calendar wrapping @effect/ui-kit Calendar.",
    registryDependencies: ["cn"],
    dependencies: ["effect", "@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "calendar.ts",
        content: `import type { Html } from "@effect/ui/html"
import { Calendar } from "@effect/ui-kit"
import * as DateTime from "effect/DateTime"
import { cn } from "./cn.js"
import { uiIcon } from "./icons.js"

export const calendarRootClass = (className?: string): string =>
  cn("inline-flex max-w-full flex-col gap-3 rounded-lg border border-border bg-surface p-3 text-foreground", className)

export const calendarHeaderClass = (className?: string): string =>
  cn("flex items-center justify-between gap-2 text-sm font-semibold", className)

export const calendarGridClass = (className?: string): string =>
  cn("border-collapse text-center text-xs tabular-nums", className)

export const calendarDayClass = (className?: string): string =>
  cn(
    "flex h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11 items-center justify-center rounded-sm text-sm tabular-nums touch-manipulation transition-colors",
    "hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
    "data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[today]:border data-[today]:border-primary",
    "data-[outside-month]:text-muted-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
    className
  )

export const styledCalendar = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly month: DateTime.Utc
    readonly today: DateTime.Utc
    readonly value: DateTime.Utc | null
    readonly firstDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined
    readonly onPick: (date: DateTime.Utc) => Msg
    readonly onMonthChange: (month: DateTime.Utc) => Msg
    readonly className?: string | undefined
  }
) =>
  Calendar(h, {
    key: options.key ?? "calendar",
    props: {
      month: options.month,
      today: options.today,
      value: options.value,
      ...(options.firstDayOfWeek !== undefined ? { firstDayOfWeek: options.firstDayOfWeek } : {})
    },
    onEmit: {
      Picked: ({ date }) => options.onPick(date),
      RequestedMonth: ({ month }) => options.onMonthChange(month)
    },
    view: (parts) => {
      const m = parts.months[0]
      return parts.root(h.div.class(calendarRootClass(options.className))).children(
        h.div.class(calendarHeaderClass()).children(
          parts.previous(
            h.button
              .attrs({ type: "button", "aria-label": "Previous month" })
              .class("relative inline-flex h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11 items-center justify-center rounded-sm touch-manipulation hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring")
          ).children(uiIcon(h, "chevronLeft", 16)),
          m.heading(h.div.class("text-sm font-semibold")).children(m.title),
          parts.next(
            h.button
              .attrs({ type: "button", "aria-label": "Next month" })
              .class("relative inline-flex h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11 items-center justify-center rounded-sm touch-manipulation hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring")
          ).children(uiIcon(h, "chevronRight", 16))
        ),
        m.grid(h.table.class(calendarGridClass())).children(
          h.thead.children(
            h.tr.children(
              ...parts.weekdays.map((wd, idx) =>
                parts.weekday({ element: h.th.key(String(idx)).class("h-7 w-8 text-xs font-medium text-muted-foreground"), index: idx }).children(wd.short)
              )
            )
          ),
          h.tbody.children(
            ...m.weeks.map((week, wi) =>
              h.tr.key(String(wi)).children(
                ...week.map((date) => {
                  const iso = DateTime.formatIsoDateUtc(date)
                  return m.cell({ element: h.td.key(iso).class("p-0.5"), date }).children(
                    m.day({ element: h.button.key(iso).attrs({ type: "button" }).class(calendarDayClass()), date }).children(
                      String(DateTime.toPartsUtc(date).day)
                    )
                  )
                })
              )
            )
          )
        )
      )
    }
  })
`
      }
    ]
  },
  {
    name: "toggle",
    title: "Toggle",
    category: "primitives",
    description: "Styled two-state pressable toggle button helper.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "toggle.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const toggleClass = (className?: string): string =>
  cn(
    "inline-flex min-h-8 items-center justify-center rounded-xs border border-transparent px-3 py-1 text-sm font-medium text-foreground touch-manipulation select-none transition-colors",
    "hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "data-[pressed]:bg-accent data-[pressed]:text-accent-foreground disabled:opacity-50",
    className
  )

export const styledToggle = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly label: string
    readonly pressed: boolean
    readonly onToggle: Msg
    readonly className?: string | undefined
  }
) =>
  h.button
    .attrs({
      type: "button",
      "aria-pressed": String(options.pressed),
      ...(options.pressed ? { "data-pressed": "" } : {})
    })
    .class(toggleClass(options.className))
    .on("click", () => options.onToggle)
    .children(options.label)
`
      }
    ]
  },
  {
    name: "toggle-group",
    title: "Toggle Group",
    category: "primitives",
    description: "Styled segmented container for grouped Toggle buttons.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "toggleGroup.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const toggleGroupClass = (className?: string): string =>
  cn("inline-flex items-center gap-1 rounded-md border border-border bg-surface p-1", className)

export const styledToggleGroup = <Msg>(
  h: Html.H<Msg>,
  label: string,
  className?: string
) => h.div.attrs({ role: "group", "aria-label": label }).class(toggleGroupClass(className))
`
      }
    ]
  }
]
