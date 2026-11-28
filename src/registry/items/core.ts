import type { RegistryItem } from "../schema.js"

/**
 * Core styled Tailwind v4 + Effect UI copy-paste blueprints.
 * Each file compiles standalone under `strict: true` and `exactOptionalPropertyTypes: true`.
 */
export const CORE_REGISTRY_ITEMS: ReadonlyArray<RegistryItem> = [
  {
    name: "cn",
    title: "Class Utilities",
    category: "primitives",
    description: "Zero-dependency class concatenation and variant helper for Effect UI Tailwind builders.",
    registryDependencies: [],
    dependencies: [],
    files: [
      {
        path: "cn.ts",
        content: `export type ClassInput = string | false | null | undefined

/** Joins conditional Tailwind class names cleanly without external runtime deps. */
export const cn = (...inputs: ReadonlyArray<ClassInput>): string =>
  inputs.filter((part): part is string => typeof part === "string" && part.trim().length > 0).join(" ")
`
      }
    ]
  },
  {
    name: "button",
    title: "Button",
    category: "primitives",
    description: "Styled button helper with variants, sizes, and accessible pending state.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "button.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "link"
export type ButtonSize = "sm" | "md" | "lg" | "icon"

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  default: "border border-transparent bg-primary text-primary-foreground hover:opacity-90",
  secondary: "border border-transparent bg-muted text-foreground hover:opacity-90",
  outline: "border border-input bg-background text-foreground hover:bg-muted",
  ghost: "border border-transparent bg-transparent text-foreground hover:bg-muted",
  destructive: "border border-transparent bg-destructive text-destructive-foreground hover:opacity-90",
  link: "bg-transparent text-primary underline-offset-4 hover:underline"
}

const SIZE_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: "min-h-8 px-3 py-1.5 text-xs rounded-sm",
  md: "min-h-9 px-4 py-2 text-sm rounded-md",
  lg: "min-h-10 px-5 py-2.5 text-sm rounded-md",
  icon: "min-h-9 min-w-9 p-0 rounded-md"
}

export const buttonClass = (options?: {
  readonly variant?: ButtonVariant | undefined
  readonly size?: ButtonSize | undefined
  readonly still?: boolean | undefined
  readonly className?: string | undefined
}): string =>
  cn(
    "inline-flex items-center justify-center gap-2 font-medium touch-manipulation select-none",
    "transition-[background-color,border-color,color,opacity,transform] duration-150 ease-[var(--ease-eui,ease-out)]",
    options?.still === true ? "" : "enabled:active:scale-[0.97] motion-reduce:active:scale-100",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANT_CLASSES[options?.variant ?? "default"],
    SIZE_CLASSES[options?.size ?? "md"],
    options?.className
  )

export const styledButton = <Msg, R = never>(
  h: Html.H<Msg>,
  options?: {
    readonly variant?: ButtonVariant | undefined
    readonly size?: ButtonSize | undefined
    readonly type?: "button" | "submit" | "reset" | undefined
    readonly disabled?: boolean | undefined
    readonly pending?: boolean | undefined
    readonly label?: string | undefined
    readonly className?: string | undefined
  }
) => {
  const isDisabled = options?.disabled === true || options?.pending === true
  return h.button
    .class(buttonClass(options))
    .attrs({
      type: options?.type ?? "button",
      ...(options?.label !== undefined ? { "aria-label": options.label } : {}),
      ...(options?.pending === true ? { "aria-busy": "true", "data-pending": "" } : {}),
      ...(isDisabled ? { disabled: "" } : {})
    })
}
`
      }
    ]
  },
  {
    name: "badge",
    title: "Badge",
    category: "primitives",
    description: "Compact semantic status badge bound to theme tokens.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "badge.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export type BadgeVariant = "default" | "secondary" | "outline" | "destructive"

const BADGE_VARIANTS: Readonly<Record<BadgeVariant, string>> = {
  default: "bg-primary text-primary-foreground border-transparent",
  secondary: "bg-muted text-foreground border-transparent",
  outline: "bg-transparent text-foreground border-border",
  destructive: "bg-destructive text-destructive-foreground border-transparent"
}

export const badgeClass = (
  variant: BadgeVariant = "default",
  className?: string
): string =>
  cn(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
    BADGE_VARIANTS[variant],
    className
  )

export const badge = <Msg>(
  h: Html.H<Msg>,
  text: string,
  options?: { readonly variant?: BadgeVariant | undefined; readonly className?: string | undefined }
) => h.span.class(badgeClass(options?.variant, options?.className)).children(text)
`
      }
    ]
  },
  {
    name: "alert",
    title: "Alert",
    category: "primitives",
    description: "Accessible inline status and error callout banner.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "alert.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"
import { uiIcon } from "./icons.js"

export type AlertVariant = "default" | "destructive"

export const alertBox = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly title: string
    readonly description?: string | undefined
    readonly variant?: AlertVariant | undefined
    readonly className?: string | undefined
  }
) => {
  const destructive = options.variant === "destructive"
  return h.div
    .class(
      cn(
        "flex items-start gap-2.5 rounded-md border p-4 text-sm",
        destructive
          ? "border-destructive/50 bg-destructive/10 text-foreground"
          : "border-border bg-surface text-foreground",
        options.className
      )
    )
    .attrs({ role: destructive ? "alert" : "status" })
    .children(
      ...(destructive ? [h.span.class("mt-0.5 shrink-0 text-destructive").children(uiIcon(h, "alertCircle", 16))] : []),
      h.div.class("min-w-0 flex-1").children(
        h.div.class("font-semibold leading-snug text-balance").children(options.title),
        ...(options.description !== undefined
          ? [h.p.class("mt-1 text-muted-foreground text-pretty").children(options.description)]
          : [])
      )
    )
}
`
      }
    ]
  },
  {
    name: "card",
    title: "Card",
    category: "layout",
    description: "Structured surface container with header, title, description, content, and footer.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "card.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const card = <Msg>(h: Html.H<Msg>, className?: string) =>
  h.section.class(
    cn("rounded-lg border border-border bg-surface text-foreground shadow-sm dark:shadow-none", className)
  )

export const cardHeader = <Msg>(h: Html.H<Msg>, className?: string) =>
  h.div.class(cn("flex flex-col gap-1 p-5 pb-3", className))

export const cardTitle = <Msg>(
  h: Html.H<Msg>,
  text: string,
  options?: string | { readonly as?: "h1" | "h2" | "h3" | undefined; readonly className?: string | undefined }
) => {
  const className = typeof options === "string" ? options : options?.className
  const level = typeof options === "string" ? "h3" : (options?.as ?? "h3")
  const cls = cn("text-base font-semibold leading-tight text-balance", className)
  if (level === "h1") return h.h1.class(cls).children(text)
  if (level === "h2") return h.h2.class(cls).children(text)
  return h.h3.class(cls).children(text)
}

export const cardDescription = <Msg>(h: Html.H<Msg>, text: string, className?: string) =>
  h.p.class(cn("text-sm text-muted-foreground text-pretty", className)).children(text)

export const cardContent = <Msg>(h: Html.H<Msg>, className?: string) =>
  h.div.class(cn("p-5 pt-2", className))

export const cardFooter = <Msg>(h: Html.H<Msg>, className?: string) =>
  h.div.class(cn("flex items-center justify-end gap-2 border-t border-border px-5 py-3", className))
`
      }
    ]
  },
  {
    name: "empty",
    title: "Empty State",
    category: "layout",
    description: "Consistent zero-data empty state composition with title, description, and actions.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "empty.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const emptyState = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly title: string
    readonly description: string
    readonly action?: View.Content<Msg> | undefined
    readonly className?: string | undefined
  }
) =>
  h.div
    .class(
      cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/50 px-6 py-10 text-center",
        options.className
      )
    )
    .children(
      h.h3.class("text-sm font-semibold text-foreground text-balance").children(options.title),
      h.p.class("mt-1 max-w-sm text-sm text-muted-foreground text-pretty").children(options.description),
      ...(options.action !== undefined ? [h.div.class("mt-4").children(options.action)] : [])
    )
`
      }
    ]
  },
  {
    name: "item",
    title: "List Item",
    category: "layout",
    description: "Structured horizontal list row with media, title, description, and trailing actions.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "item.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const itemGroup = <Msg>(h: Html.H<Msg>, className?: string) =>
  h.div.class(cn("flex flex-col divide-y divide-border rounded-md border border-border", className))

export const itemRow = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly title: string
    readonly description?: string | undefined
    readonly meta?: string | undefined
    readonly className?: string | undefined
  }
) =>
  h.div
    .class(cn("flex items-center justify-between gap-3 px-4 py-3 text-sm", options.className))
    .children(
      h.div
        .class("min-w-0 flex-1")
        .children(
          h.div.attrs({ title: options.title }).class("truncate font-medium text-foreground").children(options.title),
          ...(options.description !== undefined
            ? [h.div.attrs({ title: options.description }).class("truncate text-xs text-muted-foreground").children(options.description)]
            : [])
        ),
      ...(options.meta !== undefined
        ? [h.span.class("shrink-0 text-xs tabular-nums text-muted-foreground").children(options.meta)]
        : [])
    )
`
      }
    ]
  },
  {
    name: "kbd",
    title: "Kbd",
    category: "primitives",
    description: "Keyboard shortcut keycap badge designed to pair with formatShortcut from effect-ui-extra/page.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "kbd.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const kbd = <Msg>(
  h: Html.H<Msg>,
  label: string,
  className?: string
) =>
  h.kbd
    .class(
      cn(
        "inline-flex min-h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground",
        className
      )
    )
    .children(label)

export const kbdGroup = <Msg>(
  h: Html.H<Msg>,
  keys: ReadonlyArray<string>,
  className?: string
) =>
  h.span
    .class(cn("inline-flex items-center gap-1", className))
    .children(...keys.map((key) => kbd(h, key)))
`
      }
    ]
  },
  {
    name: "skeleton",
    title: "Skeleton",
    category: "primitives",
    description: "Reduced-motion-safe loading placeholder block.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "skeleton.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const skeleton = <Msg>(h: Html.H<Msg>, className?: string) =>
  h.div
    .class(cn("rounded-md bg-muted motion-safe:animate-pulse", className))
    .attrs({ "aria-hidden": "true" })
`
      }
    ]
  },
  {
    name: "spinner",
    title: "Spinner",
    category: "primitives",
    description: "Accessible inline loading indicator with role=status.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "spinner.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const spinner = <Msg>(
  h: Html.H<Msg>,
  options?: { readonly label?: string | undefined; readonly className?: string | undefined }
) =>
  h.span
    .class(
      cn(
        "inline-block h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-foreground motion-safe:animate-spin motion-reduce:border-dashed motion-reduce:border-foreground",
        options?.className
      )
    )
    .attrs({
      role: "status",
      "aria-label": options?.label ?? "Loading"
    })
`
      }
    ]
  },
  {
    name: "breadcrumb",
    title: "Breadcrumb",
    category: "layout",
    description: "Accessible nav breadcrumb trail with aria-current=page on the active segment.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "breadcrumb.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export interface BreadcrumbSegment {
  readonly label: string
  readonly href?: string | undefined
}

export const breadcrumb = <Msg>(
  h: Html.H<Msg>,
  segments: ReadonlyArray<BreadcrumbSegment>,
  options?: { readonly separator?: string | undefined; readonly className?: string | undefined }
) => {
  const sep = options?.separator ?? "/"
  return h.nav
    .attrs({ "aria-label": "Breadcrumb" })
    .class(cn("text-sm text-muted-foreground", options?.className))
    .children(
      h.ol
        .class("flex flex-wrap items-center gap-1.5")
        .children(
          ...segments.flatMap((seg, idx) => {
            const isLast = idx === segments.length - 1
            const item = h.li
              .key(\`bc-\${idx}\`)
              .class("inline-flex items-center")
              .children(
                isLast || seg.href === undefined
                  ? h.span
                      .class(isLast ? "font-medium text-foreground" : "")
                      .attrs(isLast ? { "aria-current": "page" } : {})
                      .children(seg.label)
                  : h.a
                      .class("hover:text-foreground transition-colors")
                      .attrs({ href: seg.href })
                      .children(seg.label)
              )
            if (isLast) return [item]
            return [
              item,
              h.li
                .key(\`sep-\${idx}\`)
                .attrs({ role: "presentation", "aria-hidden": "true" })
                .class("select-none opacity-60")
                .children(sep)
            ]
          })
        )
    )
}
`
      }
    ]
  },
  {
    name: "button-group",
    title: "Button Group",
    category: "layout",
    description: "Joined horizontal or vertical group of related action buttons.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "buttonGroup.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const buttonGroup = <Msg>(
  h: Html.H<Msg>,
  options?: {
    readonly label?: string | undefined
    readonly orientation?: "horizontal" | "vertical" | undefined
    readonly className?: string | undefined
  }
) => {
  const vertical = options?.orientation === "vertical"
  return h.div
    .attrs({
      role: "group",
      ...(options?.label !== undefined ? { "aria-label": options.label } : {})
    })
    .class(
      cn(
        "inline-flex",
        vertical
          ? "flex-col [&>*:not(:first-child)]:-mt-px [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none"
          : "flex-row [&>*:not(:first-child)]:-ms-px [&>*:not(:first-child)]:rounded-s-none [&>*:not(:last-child)]:rounded-e-none",
        options?.className
      )
    )
}
`
      }
    ]
  },
  {
    name: "input-group",
    title: "Input Group",
    category: "layout",
    description: "Text input framed with leading and trailing inline addons or action buttons.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "inputGroup.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const inputGroup = <Msg>(h: Html.H<Msg>, className?: string) =>
  h.div.class(
    cn(
      "flex min-h-9 w-full items-center overflow-hidden rounded-md border border-input bg-background text-base md:text-sm",
      "focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ring",
      className
    )
  )

export const inputGroupAddon = <Msg>(
  h: Html.H<Msg>,
  text: string,
  className?: string
) =>
  h.span
    .class(cn("flex h-full items-center bg-muted px-3 text-xs text-muted-foreground", className))
    .children(text)

export const inputGroupField = <Msg>(
  h: Html.H<Msg>,
  options?: {
    readonly name?: string | undefined
    readonly placeholder?: string | undefined
    readonly value?: string | undefined
    readonly label?: string | undefined
    readonly className?: string | undefined
  }
) =>
  h.input
    .class(cn("h-full min-h-9 min-w-0 flex-1 bg-transparent px-3 text-base md:text-sm text-foreground outline-none", options?.className))
    .attrs({
      type: "text",
      ...(options?.name !== undefined ? { name: options.name } : {}),
      ...(options?.placeholder !== undefined ? { placeholder: options.placeholder } : {}),
      ...(options?.label !== undefined ? { "aria-label": options.label } : {})
    })
    .value(options?.value ?? "")
`
      }
    ]
  }
]
