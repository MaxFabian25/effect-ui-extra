import type { RegistryItem } from "../schema.js"

/**
 * 13 display, layout, and container blueprints completing 64/64 shadcn parity:
 * `accordion`, `collapsible`, `tabs`, `avatar`, `aspect-ratio`, `progress`,
 * `separator`, `scroll-area`, `resizable`, `pagination`, `carousel`,
 * `direction`, `message-scroller`.
 */
export const DISPLAY_REGISTRY_ITEMS: ReadonlyArray<RegistryItem> = [
  {
    name: "accordion",
    title: "Accordion",
    category: "layout",
    description: "Styled stacked disclosure sections wrapping @effect/ui-kit Accordion and AccordionItem.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "accordion.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { Accordion, AccordionItem } from "@effect/ui-kit"
import { cn } from "./cn.js"

export const accordionItemClass = (className?: string): string =>
  cn("border-b border-border", className)

export const accordionTriggerClass = (className?: string): string =>
  cn(
    "flex min-h-10 w-full items-center justify-between py-3 text-start text-sm font-medium text-foreground touch-manipulation hover:underline",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    className
  )

export const accordionPanelClass = (className?: string): string =>
  cn("pb-3 text-sm text-muted-foreground", className)

export interface StyledAccordionSection<Msg> {
  readonly value: string
  readonly title: string
  readonly content: View.Content<Msg>
  readonly disabled?: boolean | undefined
}

export const styledAccordion = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly value: ReadonlyArray<string>
    readonly multiple?: boolean | undefined
    readonly items: ReadonlyArray<StyledAccordionSection<Msg>>
    readonly onValueChange: (value: ReadonlyArray<string>) => Msg
    readonly className?: string | undefined
  }
) =>
  Accordion(h, {
    key: options.key ?? "accordion",
    props: {
      value: options.value,
      ...(options.multiple !== undefined ? { multiple: options.multiple } : {})
    },
    onEmit: {
      Toggled: ({ value }) => options.onValueChange(value)
    },
    view: (acc) =>
      acc.root(h.div.class(cn("w-full divide-y divide-border", options.className))).children(
        ...options.items.map((item, index) =>
          AccordionItem(h, {
            key: item.value,
            props: {
              value: item.value,
              index,
              ...(item.disabled !== undefined ? { disabled: item.disabled } : {})
            },
            onEmit: {
              Toggled: () => undefined,
              Settled: () => undefined
            },
            view: (part) =>
              part.root(h.div.class(accordionItemClass())).children(
                part.header(h.h3.class("m-0")).children(
                  part.trigger(h.button.attrs({ type: "button" }).class(accordionTriggerClass())).children(item.title)
                ),
                part.panel(h.div.class(accordionPanelClass()))?.children(item.content)
              )
          })
        )
      )
  })
`
      }
    ]
  },
  {
    name: "collapsible",
    title: "Collapsible",
    category: "layout",
    description: "Styled collapsible trigger and content region wrapping @effect/ui-kit Collapsible.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "collapsible.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { Collapsible } from "@effect/ui-kit"
import { cn } from "./cn.js"

export const collapsibleTriggerClass = (className?: string): string =>
  cn(
    "inline-flex min-h-8 items-center gap-1.5 rounded-sm px-2.5 py-1 text-sm font-medium text-foreground touch-manipulation select-none hover:bg-muted",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    className
  )

export const collapsiblePanelClass = (className?: string): string =>
  cn("overflow-hidden text-sm text-muted-foreground", className)

export const styledCollapsible = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly open: boolean
    readonly triggerLabel: string
    readonly content: View.Content<Msg>
    readonly onOpenChange: (open: boolean) => Msg
    readonly className?: string | undefined
  }
) =>
  Collapsible(h, {
    key: options.key ?? "collapsible",
    props: { open: options.open },
    onEmit: {
      Toggled: ({ open }) => options.onOpenChange(open),
      Settled: () => undefined
    },
    view: (parts) =>
      parts.root(h.div.class(cn("flex flex-col gap-2", options.className))).children(
        parts.trigger(h.button.attrs({ type: "button" }).class(collapsibleTriggerClass())).children(options.triggerLabel),
        parts.panel(h.div.class(collapsiblePanelClass()))?.children(options.content)
      )
  })
`
      }
    ]
  },
  {
    name: "tabs",
    title: "Tabs",
    category: "layout",
    description: "Styled tab list, sliding indicator, and panels wrapping @effect/ui-kit Tabs.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "tabs.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { Tabs } from "@effect/ui-kit"
import { cn } from "./cn.js"

export const tabsListClass = (className?: string): string =>
  cn("relative inline-flex flex-wrap items-center gap-1 rounded-md bg-muted p-1 text-muted-foreground", className)

export const tabsTriggerClass = (className?: string): string =>
  cn(
    "relative z-10 inline-flex min-h-8 items-center justify-center rounded-xs border border-transparent px-3 py-1 text-sm font-medium touch-manipulation select-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "data-[active]:bg-background data-[active]:text-foreground data-[active]:shadow-sm dark:data-[active]:shadow-none aria-[selected=true]:bg-background aria-[selected=true]:text-foreground",
    className
  )

export const tabsPanelClass = (className?: string): string =>
  cn("mt-3 text-sm text-foreground", className)

export interface StyledTabItem<Msg> {
  readonly value: string
  readonly label: string
  readonly content: View.Content<Msg>
  readonly disabled?: boolean | undefined
}

export const styledTabs = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly value: string | null
    readonly items: ReadonlyArray<StyledTabItem<Msg>>
    readonly onSelect: (value: string) => Msg
    readonly className?: string | undefined
  }
) =>
  Tabs(h, {
    key: options.key ?? "tabs",
    props: {
      value: options.value,
      tabs: options.items.map((item) => ({
        value: item.value,
        ...(item.disabled !== undefined ? { disabled: item.disabled } : {})
      }))
    },
    onEmit: {
      Selected: ({ value }) => options.onSelect(value)
    },
    view: (parts) =>
      parts.root(h.div.class(cn("w-full", options.className))).children(
        parts.list(h.div.class(tabsListClass())).children(
          ...options.items.map((item) =>
            parts.tab({ element: h.button.key(item.value).attrs({ type: "button" }).class(tabsTriggerClass()), value: item.value }).children(item.label)
          ),
          parts.indicator(h.span.class("pointer-events-none absolute rounded-xs bg-background shadow-sm dark:shadow-none transition-[transform,width,height] duration-150 ease-[var(--ease-eui,ease-out)] motion-reduce:transition-none"))
        ),
        ...options.items.map((item) =>
          parts.panel({ element: h.div.key(item.value).class(tabsPanelClass()), value: item.value })?.children(item.content)
        )
      )
  })
`
      }
    ]
  },
  {
    name: "avatar",
    title: "Avatar",
    category: "primitives",
    description: "Styled circular user avatar with image and fallback initials.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "avatar.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const styledAvatar = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly src?: string | undefined
    readonly alt: string
    readonly fallback: string
    readonly className?: string | undefined
  }
) =>
  h.span
    .class(
      cn(
        "relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-foreground",
        options.src === undefined ? "border border-border" : "",
        options.className
      )
    )
    .children(
      options.src !== undefined
        ? h.img.attrs({ src: options.src, alt: options.alt }).class("h-full w-full rounded-full object-cover outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10")
        : h.span.attrs({ "aria-label": options.alt }).children(options.fallback)
    )
`
      }
    ]
  },
  {
    name: "aspect-ratio",
    title: "Aspect Ratio",
    category: "layout",
    description: "Responsive aspect-ratio container preserving exact media proportions.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "aspectRatio.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const aspectRatioBox = <Msg>(
  h: Html.H<Msg>,
  ratio = 16 / 9,
  className?: string
) =>
  h.div
    .class(cn("relative w-full overflow-hidden rounded-md", className))
    .style({ aspectRatio: String(ratio) })
`
      }
    ]
  },
  {
    name: "progress",
    title: "Progress",
    category: "primitives",
    description: "Accessible progress bar with semantic role=progressbar and token fill.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "progress.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const styledProgress = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly label: string
    readonly value: number
    readonly max?: number | undefined
    readonly className?: string | undefined
  }
) => {
  const max = Math.max(1, options.max ?? 100)
  const clamped = Math.max(0, Math.min(max, options.value))
  const pct = Math.round((clamped / max) * 100)
  return h.div
    .attrs({
      role: "progressbar",
      "aria-label": options.label,
      "aria-valuemin": "0",
      "aria-valuemax": String(max),
      "aria-valuenow": String(clamped)
    })
    .class(cn("relative h-2 w-full overflow-hidden rounded-full border border-transparent bg-muted", options.className))
    .children(
      h.div
        .class("h-full w-full origin-left rtl:origin-right bg-primary transition-transform duration-200 ease-[var(--ease-eui,ease-out)] motion-reduce:transition-none")
        .style({ transform: \`scaleX(\${(pct / 100).toFixed(4)})\` })
    )
}
`
      }
    ]
  },
  {
    name: "separator",
    title: "Separator",
    category: "primitives",
    description: "Accessible horizontal or vertical visual divider line.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "separator.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const styledSeparator = <Msg>(
  h: Html.H<Msg>,
  options?: {
    readonly orientation?: "horizontal" | "vertical" | undefined
    readonly decorative?: boolean | undefined
    readonly className?: string | undefined
  }
) => {
  const vertical = options?.orientation === "vertical"
  return h.div
    .attrs(
      options?.decorative === true
        ? { "aria-hidden": "true" }
        : { role: "separator", "aria-orientation": vertical ? "vertical" : "horizontal" }
    )
    .class(cn("shrink-0 bg-border", vertical ? "h-full w-px" : "h-px w-full", options?.className))
}
`
      }
    ]
  },
  {
    name: "scroll-area",
    title: "Scroll Area",
    category: "layout",
    description: "Styled scroll viewport and custom scrollbars wrapping @effect/ui-kit ScrollArea.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "scrollArea.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { ScrollArea } from "@effect/ui-kit"
import { cn } from "./cn.js"

export const scrollAreaRootClass = (className?: string): string =>
  cn("relative overflow-hidden", className)

export const scrollAreaViewportClass = (className?: string): string =>
  cn("h-full w-full overflow-auto overscroll-contain rounded-[inherit]", className)

export const scrollAreaTrackClass = (className?: string): string =>
  cn("flex touch-none select-none p-0.5 transition-opacity data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:h-2.5", className)

export const scrollAreaThumbClass = (className?: string): string =>
  cn("relative flex-1 rounded-full bg-border hover:bg-muted-foreground/50", className)

export const styledScrollArea = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly content: View.Content<Msg>
    readonly className?: string | undefined
  }
) =>
  ScrollArea(h, {
    key: options.key ?? "scroll-area",
    props: {},
    view: (parts) =>
      parts.root(h.div.class(scrollAreaRootClass(options.className))).children(
        parts.viewport(h.div.class(scrollAreaViewportClass())).children(
          parts.content(h.div).children(options.content)
        ),
        parts.scrollbar({
          element: h.div.class(scrollAreaTrackClass()),
          thumb: h.div.class(scrollAreaThumbClass()),
          orientation: "vertical"
        }),
        parts.scrollbar({
          element: h.div.class(scrollAreaTrackClass()),
          thumb: h.div.class(scrollAreaThumbClass()),
          orientation: "horizontal"
        }),
        parts.corner(h.div.class("bg-transparent"))
      )
  })
`
      }
    ]
  },
  {
    name: "resizable",
    title: "Resizable Panes",
    category: "layout",
    description: "Styled split-pane container wrapping Resizable from effect-ui-extra/widgets.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "effect-ui-extra"],
    files: [
      {
        path: "resizable.ts",
        content: `import type { Html } from "@effect/ui/html"
import { Resizable, type ResizableProps } from "effect-ui-extra/widgets"
import { cn } from "./cn.js"

export const resizableGroupClass = (className?: string): string =>
  cn("flex h-full w-full overflow-hidden rounded-md border border-border", className)

export const resizableHandleClass = (className?: string): string =>
  cn(
    "relative flex w-6 shrink-0 cursor-col-resize touch-none items-center justify-center bg-border bg-clip-content px-2.5 transition-colors",
    "hover:bg-primary/60 focus-visible:outline-2 focus-visible:outline-ring",
    className
  )

export const styledResizable = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly props: ResizableProps
    readonly onResize: (sizes: ReadonlyArray<number>) => Msg
    readonly className?: string | undefined
  }
) =>
  h.div.class(resizableGroupClass(options.className)).children(
    Resizable(h, {
      key: options.key ?? "resizable",
      props: options.props,
      onEmit: {
        Resized: ({ sizes }) => options.onResize(sizes)
      }
    })
  )
`
      }
    ]
  },
  {
    name: "pagination",
    title: "Pagination",
    category: "data",
    description: "Styled pagination bar wrapping Pagination from effect-ui-extra/widgets.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "effect-ui-extra"],
    files: [
      {
        path: "pagination.ts",
        content: `import type { Html } from "@effect/ui/html"
import { Pagination } from "effect-ui-extra/widgets"
import { cn } from "./cn.js"

export const paginationNavClass = (className?: string): string =>
  cn("flex items-center justify-center gap-1 text-sm", className)

export const paginationButtonClass = (active: boolean, className?: string): string =>
  cn(
    "inline-flex min-h-8 min-w-8 items-center justify-center rounded-md border border-transparent px-2.5 text-sm font-medium tabular-nums touch-manipulation select-none transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
    className
  )

export const styledPagination = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly page: number
    readonly totalPages: number
    readonly label?: string | undefined
    readonly onPageChange: (page: number) => Msg
    readonly className?: string | undefined
  }
) =>
  h.div.class(paginationNavClass(options.className)).children(
    Pagination(h, {
      key: options.key ?? "pagination",
      props: {
        page: options.page,
        totalPages: options.totalPages,
        ...(options.label !== undefined ? { label: options.label } : {})
      },
      onEmit: {
        PageChanged: ({ page }) => options.onPageChange(page)
      }
    })
  )
`
      }
    ]
  },
  {
    name: "carousel",
    title: "Carousel",
    category: "layout",
    description: "Styled accessible slide carousel wrapping Carousel from effect-ui-extra/widgets.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "effect-ui-extra"],
    files: [
      {
        path: "carousel.ts",
        content: `import type { Html } from "@effect/ui/html"
import { Carousel, type CarouselProps } from "effect-ui-extra/widgets"
import { cn } from "./cn.js"

export const carouselContainerClass = (className?: string): string =>
  cn("relative flex flex-col gap-3 rounded-lg border border-border bg-surface p-4", className)

export const carouselSlideClass = (className?: string): string =>
  cn("min-h-32 rounded-md border border-border bg-background p-4 text-sm text-foreground", className)

export const carouselDotClass = (active: boolean, className?: string): string =>
  cn(
    "relative h-2.5 w-2.5 rounded-full border transition-colors touch-manipulation before:absolute before:-inset-2.5",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    active ? "border-primary bg-primary" : "border-input bg-background hover:bg-muted",
    className
  )

export const styledCarousel = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly props: CarouselProps
    readonly onSlideChange: (index: number) => Msg
    readonly className?: string | undefined
  }
) =>
  h.div.class(carouselContainerClass(options.className)).children(
    Carousel(h, {
      key: options.key ?? "carousel",
      props: options.props,
      onEmit: {
        IndexChanged: ({ index }) => options.onSlideChange(index),
        AutoplayToggled: () => undefined
      }
    })
  )
`
      }
    ]
  },
  {
    name: "direction",
    title: "Direction Wrapper",
    category: "layout",
    description: "Explicit LTR/RTL text-direction wrapper pairing with @effect/ui-kit DirectionProvider.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "direction.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const directionBox = <Msg>(
  h: Html.H<Msg>,
  dir: "ltr" | "rtl",
  className?: string
) => h.div.attrs({ dir }).class(cn("w-full", className))
`
      }
    ]
  },
  {
    name: "message-scroller",
    title: "Message Scroller",
    category: "ai",
    description: "Styled streaming conversation scroll container with jump-to-bottom button pairing with StickToBottom.",
    registryDependencies: ["cn", "button"],
    dependencies: ["@effect/ui", "effect-ui-extra"],
    files: [
      {
        path: "messageScroller.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { buttonClass } from "./button.js"
import { cn } from "./cn.js"

export const messageScroller = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly label?: string | undefined
    readonly showJumpButton: boolean
    readonly unseenCount?: number | undefined
    readonly onJumpToBottom: Msg
    readonly items: ReadonlyArray<View.Content<Msg>>
    readonly className?: string | undefined
  }
) =>
  h.div
    .attrs({ "data-message-scroller": "" })
    .class(cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", options.className))
    .children(
      h.div
        .attrs({ role: "log", "aria-label": options.label ?? "Conversation messages", "aria-live": "polite" })
        .class("flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4")
        .children(...options.items),
      ...(options.showJumpButton
        ? [
            h.button
              .attrs({ type: "button" })
              .class(
                cn(
                  buttonClass({ variant: "secondary", size: "sm" }),
                  "absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 tabular-nums shadow-md dark:shadow-none"
                )
              )
              .on("click", () => options.onJumpToBottom)
              .children(
                options.unseenCount !== undefined && options.unseenCount > 0
                  ? \`Jump to bottom (\${options.unseenCount} new)\`
                  : "Jump to bottom"
              )
          ]
        : [])
    )
`
      }
    ]
  },
  {
    name: "bubble",
    title: "Bubble",
    category: "ai",
    description: "Compact chat or annotation bubble pairing with Message and Message Scroller.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "bubble.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export type BubbleVariant = "neutral" | "accent" | "outline"

export const bubbleClass = (variant: BubbleVariant = "neutral", className?: string): string =>
  cn(
    "inline-flex max-w-prose flex-col gap-1 rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
    variant === "accent"
      ? "bg-accent text-accent-foreground"
      : variant === "outline"
        ? "border border-border bg-transparent text-foreground"
        : "bg-surface text-foreground border border-border/60",
    className
  )

export const bubble = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly variant?: BubbleVariant | undefined
    readonly content: View.Content<Msg>
    readonly className?: string | undefined
  }
) =>
  h.div
    .attrs({ "data-bubble": options.variant ?? "neutral" })
    .class(bubbleClass(options.variant, options.className))
    .children(options.content)
`
      }
    ]
  },
  {
    name: "table",
    title: "Table",
    category: "data",
    description: "Styled semantic HTML table building blocks (table, header, body, row, head, cell, caption).",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "table.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const tableContainerClass = (className?: string): string =>
  cn("relative w-full overflow-x-auto rounded-lg border border-border", className)

export const tableClass = (className?: string): string =>
  cn("w-full caption-bottom text-sm text-foreground", className)

export const tableHeaderClass = (className?: string): string =>
  cn("[&_tr]:border-b border-border bg-surface", className)

export const tableBodyClass = (className?: string): string =>
  cn("[&_tr:last-child]:border-0", className)

export const tableRowClass = (className?: string): string =>
  cn("border-b border-border hover:bg-surface/60 data-[state=selected]:bg-surface", className)

export const tableHeadClass = (className?: string): string =>
  cn("h-10 px-3 text-start align-middle font-medium text-muted-foreground", className)

export const tableCellClass = (className?: string): string =>
  cn("p-3 align-middle tabular-nums", className)

export const tableCaptionClass = (className?: string): string =>
  cn("mt-3 text-xs text-muted-foreground", className)

export const styledTable = <Msg>(h: Html.H<Msg>, className?: string) =>
  h.table.class(tableClass(className))
`
      }
    ]
  }
]
