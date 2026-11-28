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
    "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground transition-colors",
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
    "flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
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
  cn("text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-60", className)

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
        ? [h.p.attrs({ id: \`\${options.id}-err\`, role: "alert" }).class("text-xs font-medium text-destructive").children(options.error)]
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
    "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border border-input bg-background text-primary-foreground transition-colors",
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
    .class(cn("inline-flex cursor-pointer items-center gap-2 text-sm text-foreground", options.className))
    .children(
      h.input
        .attrs({
          id: options.id,
          type: "checkbox",
          ...(options.checked ? { checked: "" } : {}),
          ...(options.disabled === true ? { disabled: "" } : {})
        })
        .class("h-4 w-4 rounded-xs border border-input accent-primary")
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
    "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-muted p-0.5 transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "data-[checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
    className
  )

export const switchThumbClass = (className?: string): string =>
  cn(
    "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
    "data-[checked]:translate-x-4",
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
    "flex items-start gap-2.5 rounded-md border border-border bg-background px-3 py-2 text-left text-sm transition-colors",
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
) =>
  h.div
    .attrs({ role: "radiogroup", "aria-label": options.label })
    .class(cn("flex flex-col gap-2", options.className))
    .children(
      ...options.choices.map((c) => {
        const checked = c.value === options.value
        return h.button
          .key(c.value)
          .attrs({
            type: "button",
            role: "radio",
            "aria-checked": String(checked),
            ...(checked ? { "data-checked": "" } : {})
          })
          .class(radioItemClass())
          .on("click", () => options.onSelect(c.value))
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
`
      }
    ]
  },
  {
    name: "select",
    title: "Select",
    category: "primitives",
    description: "Styled trigger, popup, and option classes for @effect/ui-kit Select.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "select.ts",
        content: `import { cn } from "./cn.js"

export const selectTriggerClass = (className?: string): string =>
  cn(
    "inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground",
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-50",
    className
  )

export const selectPopupClass = (className?: string): string =>
  cn(
    "z-50 min-w-36 overflow-hidden rounded-md border border-border bg-surface p-1 text-foreground shadow-md",
    "transition-all duration-120 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
    className
  )

export const selectItemClass = (className?: string): string =>
  cn(
    "flex cursor-pointer select-none items-center justify-between rounded-sm px-2.5 py-1.5 text-sm outline-none",
    "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[selected]:font-medium data-[disabled]:opacity-50",
    className
  )
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
        "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground",
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
    description: "Styled input, chip container, popup, and item classes for @effect/ui-kit Combobox.",
    registryDependencies: ["cn", "input", "select"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "combobox.ts",
        content: `import { cn } from "./cn.js"
import { inputClass } from "./input.js"
import { selectItemClass, selectPopupClass } from "./select.js"

export const comboboxInputClass = (className?: string): string => inputClass(className)

export const comboboxChipsClass = (className?: string): string =>
  cn(
    "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm",
    "focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ring",
    className
  )

export const comboboxChipClass = (className?: string): string =>
  cn("inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-foreground", className)

export const comboboxPopupClass = (className?: string): string => selectPopupClass(className)

export const comboboxItemClass = (className?: string): string => selectItemClass(className)
`
      }
    ]
  },
  {
    name: "input-otp",
    title: "Input OTP",
    category: "primitives",
    description: "Styled segmented one-time passcode slot classes for @effect/ui-kit OTPField.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "inputOtp.ts",
        content: `import { cn } from "./cn.js"

export const otpGroupClass = (className?: string): string =>
  cn("inline-flex items-center gap-2", className)

export const otpSlotClass = (className?: string): string =>
  cn(
    "flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background font-mono text-base font-semibold text-foreground",
    "data-[active]:outline-2 data-[active]:outline-offset-1 data-[active]:outline-ring data-[invalid]:border-destructive",
    className
  )
`
      }
    ]
  },
  {
    name: "slider",
    title: "Slider",
    category: "primitives",
    description: "Styled track, range fill, and thumb classes for @effect/ui-kit Slider.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "slider.ts",
        content: `import { cn } from "./cn.js"

export const sliderRootClass = (className?: string): string =>
  cn("relative flex w-full touch-none select-none items-center py-2", className)

export const sliderTrackClass = (className?: string): string =>
  cn("relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted", className)

export const sliderIndicatorClass = (className?: string): string =>
  cn("absolute h-full bg-primary", className)

export const sliderThumbClass = (className?: string): string =>
  cn(
    "block h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm transition-transform",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[dragging]:scale-110",
    className
  )
`
      }
    ]
  },
  {
    name: "calendar",
    title: "Calendar",
    category: "data",
    description: "Styled month header, weekday grid, and day cell classes for @effect/ui-kit Calendar.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "calendar.ts",
        content: `import { cn } from "./cn.js"

export const calendarRootClass = (className?: string): string =>
  cn("inline-flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 text-foreground", className)

export const calendarHeaderClass = (className?: string): string =>
  cn("flex items-center justify-between gap-2 text-sm font-semibold", className)

export const calendarGridClass = (className?: string): string =>
  cn("grid grid-cols-7 gap-1 text-center text-xs", className)

export const calendarDayClass = (className?: string): string =>
  cn(
    "flex h-8 w-8 items-center justify-center rounded-sm text-sm transition-colors",
    "hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
    "data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[today]:border data-[today]:border-primary",
    "data-[outside-month]:text-muted-foreground/50 data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
    className
  )
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
    "inline-flex h-9 items-center justify-center rounded-md border border-transparent px-3 text-sm font-medium text-foreground transition-colors",
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
