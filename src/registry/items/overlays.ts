import type { RegistryItem } from "../schema.js"

/**
 * 13 styled overlay, menu, and notification blueprints completing shadcn parity:
 * `alert-dialog`, `dialog`, `drawer`, `popover`, `tooltip`, `hover-card`,
 * `dropdown-menu`, `context-menu`, `menubar`, `navigation-menu`, `toast`,
 * `sonner`, `command`.
 */
export const OVERLAY_REGISTRY_ITEMS: ReadonlyArray<RegistryItem> = [
  {
    name: "alert-dialog",
    title: "Alert Dialog",
    category: "layout",
    description: "Styled destructive confirmation modal wrapping @effect/ui-kit AlertDialog.",
    registryDependencies: ["cn", "button"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "alertDialog.ts",
        content: `import { AlertDialog } from "@effect/ui-kit"
import type { Html } from "@effect/ui/html"
import { buttonClass } from "./button.js"
import { cn } from "./cn.js"

export const styledAlertDialog = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly open: boolean
    readonly title: string
    readonly description: string
    readonly confirmLabel?: string | undefined
    readonly cancelLabel?: string | undefined
    readonly onConfirm: Msg
    readonly onCancel: Msg
    readonly className?: string | undefined
  }
) =>
  AlertDialog(h, {
    key: options.key ?? "alert-dialog",
    props: { open: options.open },
    onEmit: {
      RequestedOpen: () => undefined,
      RequestedClose: () => options.onCancel,
      Settled: () => undefined
    },
    view: (parts) =>
      h.div.attrs({ "data-alert-dialog-root": "" }).children(
        parts.portal(
          h.dialog.class("fixed inset-0 m-0 max-h-none max-w-none bg-transparent p-0")
        )?.children(
          parts.backdrop(
            h.div.class("fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0")
          ),
          parts.popup(
            h.div.class(
              cn(
                "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 text-foreground shadow-lg",
                options.className
              )
            )
          ).children(
            parts.title(h.h2.class("text-base font-semibold")).children(options.title),
            parts.description(h.p.class("mt-2 text-sm text-muted-foreground")).children(options.description),
            h.div.class("mt-5 flex items-center justify-end gap-2").children(
              parts.close(h.button.class(buttonClass({ variant: "outline" })).attrs({ type: "button" })).children(options.cancelLabel ?? "Cancel"),
              h.button
                .attrs({ type: "button" })
                .class(buttonClass({ variant: "destructive" }))
                .on("click", () => options.onConfirm)
                .children(options.confirmLabel ?? "Continue")
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
    name: "drawer",
    title: "Drawer",
    category: "layout",
    description: "Styled bottom/side swipeable drawer wrapping @effect/ui-kit Drawer.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "drawer.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { Drawer } from "@effect/ui-kit"
import { cn } from "./cn.js"

export const drawerBackdropClass = (className?: string): string =>
  cn(
    "fixed inset-0 z-50 bg-black/50 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
    className
  )

export const drawerPopupClass = (className?: string): string =>
  cn(
    "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] w-full max-w-xl flex-col rounded-t-lg border-t border-border bg-surface p-5 text-foreground shadow-lg",
    "transition-transform duration-200 data-[swiping]:transition-none",
    className
  )

export const drawerHandleClass = (className?: string): string =>
  cn("mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30", className)

export const styledDrawer = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly open: boolean
    readonly triggerLabel: string
    readonly title: string
    readonly description?: string | undefined
    readonly body: View.Content<Msg>
    readonly onOpen: Msg
    readonly onClose: Msg
    readonly className?: string | undefined
  }
) =>
  Drawer(h, {
    key: options.key ?? "drawer",
    props: { open: options.open, swipeDirection: "down" },
    onEmit: {
      RequestedOpen: () => options.onOpen,
      RequestedClose: () => options.onClose,
      Settled: () => undefined,
      Snapped: () => undefined
    },
    view: (parts) =>
      h.div.children(
        parts.trigger(h.button.attrs({ type: "button" }).class("inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium")).children(options.triggerLabel),
        parts.portal(h.dialog.class("fixed inset-0 m-0 max-h-none max-w-none bg-transparent p-0"))?.children(
          parts.backdrop(h.div.class(drawerBackdropClass())),
          parts.viewport(h.div.class("fixed inset-0 z-50 flex items-end justify-center")).children(
            parts.popup(h.div.class(drawerPopupClass(options.className))).children(
              h.div.attrs({ "aria-hidden": "true" }).class(drawerHandleClass()),
              parts.title(h.h2.class("text-base font-semibold")).children(options.title),
              ...(options.description !== undefined
                ? [parts.description(h.p.class("mt-1 text-sm text-muted-foreground")).children(options.description)]
                : []),
              parts.content(h.div.class("mt-4")).children(options.body),
              h.div.class("mt-4 flex justify-end").children(
                parts.close(h.button.attrs({ type: "button" }).class("inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium")).children("Close")
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
    name: "popover",
    title: "Popover",
    category: "layout",
    description: "Styled floating popover wrapping @effect/ui-kit Popover with trigger, popup, and arrow.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "popover.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { Popover } from "@effect/ui-kit"
import { cn } from "./cn.js"

export const popoverPopupClass = (className?: string): string =>
  cn(
    "z-50 w-72 rounded-md border border-border bg-surface p-4 text-sm text-foreground shadow-md",
    "transition-all duration-150 origin-[var(--transform-origin)] data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
    className
  )

export const popoverArrowClass = (className?: string): string =>
  cn("h-2.5 w-2.5 rotate-45 border border-border bg-surface", className)

export const styledPopover = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly open: boolean
    readonly triggerLabel: string
    readonly title?: string | undefined
    readonly body: View.Content<Msg>
    readonly onOpen: Msg
    readonly onClose: Msg
    readonly className?: string | undefined
  }
) =>
  Popover(h, {
    key: options.key ?? "popover",
    props: { open: options.open },
    onEmit: {
      RequestedOpen: () => options.onOpen,
      RequestedClose: () => options.onClose,
      Settled: () => undefined
    },
    view: (parts) =>
      h.div.class("inline-block").children(
        parts.trigger({ element: h.button.attrs({ type: "button" }).class("inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium") }).children(options.triggerLabel),
        parts.portal(h.dialog.class("m-0 border-0 bg-transparent p-0"))?.children(
          parts.positioner(h.div.key("pos")).children(
            parts.popup(h.div.class(popoverPopupClass(options.className))).children(
              parts.arrow(h.div.class(popoverArrowClass())),
              ...(options.title !== undefined ? [parts.title(h.h3.class("mb-2 text-sm font-semibold")).children(options.title)] : []),
              options.body
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
    name: "tooltip",
    title: "Tooltip",
    category: "layout",
    description: "Styled floating tooltip wrapping @effect/ui-kit Tooltip.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "tooltip.ts",
        content: `import type { Html } from "@effect/ui/html"
import { Tooltip } from "@effect/ui-kit"
import { cn } from "./cn.js"

export const tooltipPopupClass = (className?: string): string =>
  cn(
    "z-50 max-w-xs rounded-sm bg-foreground px-2.5 py-1 text-xs font-medium text-background shadow-sm",
    "transition-all duration-120 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
    className
  )

export const styledTooltip = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly open: boolean
    readonly triggerLabel: string
    readonly tip: string
    readonly onOpen: Msg
    readonly onClose: Msg
    readonly className?: string | undefined
  }
) =>
  Tooltip(h, {
    key: options.key ?? "tooltip",
    props: { open: options.open },
    onEmit: {
      RequestedOpen: () => options.onOpen,
      RequestedClose: () => options.onClose
    },
    view: (parts) =>
      h.span.class("inline-flex").children(
        parts.trigger(h.button.attrs({ type: "button" }).class("inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium")).children(options.triggerLabel),
        parts.positioner(h.div).children(
          parts.popup(h.div.class(tooltipPopupClass(options.className))).children(options.tip)
        )
      )
  })
`
      }
    ]
  },
  {
    name: "hover-card",
    title: "Hover Card",
    category: "layout",
    description: "Styled preview card wrapping @effect/ui-kit PreviewCard.",
    registryDependencies: ["cn", "popover"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "hoverCard.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { PreviewCard } from "@effect/ui-kit"
import { popoverPopupClass } from "./popover.js"

export const hoverCardPopupClass = (className?: string): string =>
  popoverPopupClass(className)

export const styledHoverCard = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly open: boolean
    readonly href: string
    readonly triggerLabel: string
    readonly body: View.Content<Msg>
    readonly onOpen: Msg
    readonly onClose: Msg
    readonly className?: string | undefined
  }
) =>
  PreviewCard(h, {
    key: options.key ?? "hover-card",
    props: { open: options.open },
    onEmit: {
      RequestedOpen: () => options.onOpen,
      RequestedClose: () => options.onClose,
      Settled: () => undefined
    },
    view: (parts) =>
      h.span.class("inline-flex").children(
        parts.trigger({ element: h.a.attrs({ href: options.href }).class("underline underline-offset-4") }).children(options.triggerLabel),
        parts.portal(h.div)?.children(
          parts.positioner(h.div.key("pos")).children(
            parts.popup(h.div.class(hoverCardPopupClass(options.className))).children(options.body)
          )
        )
      )
  })
`
      }
    ]
  },
  {
    name: "dropdown-menu",
    title: "Dropdown Menu",
    category: "layout",
    description: "Styled dropdown menu wrapping @effect/ui-kit Menu.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "dropdownMenu.ts",
        content: `import type { Html } from "@effect/ui/html"
import { Menu } from "@effect/ui-kit"
import { cn } from "./cn.js"

export const menuPopupClass = (className?: string): string =>
  cn(
    "z-50 min-w-44 overflow-hidden rounded-md border border-border bg-surface p-1 text-foreground shadow-md",
    "transition-all duration-120 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
    className
  )

export const menuItemClass = (className?: string): string =>
  cn(
    "flex cursor-pointer select-none items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-sm outline-none",
    "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
    className
  )

export const menuSeparatorClass = (className?: string): string =>
  cn("my-1 h-px bg-border", className)

export interface StyledMenuAction {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean | undefined
}

export const styledDropdownMenu = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly open: boolean
    readonly triggerLabel: string
    readonly items: ReadonlyArray<StyledMenuAction>
    readonly onOpenChange: (open: boolean) => Msg
    readonly onPick: (value: string) => Msg
    readonly className?: string | undefined
  }
) =>
  Menu(h, {
    key: options.key ?? "dropdown-menu",
    props: { open: options.open, items: options.items },
    onEmit: {
      RequestedOpen: () => options.onOpenChange(true),
      RequestedClose: () => options.onOpenChange(false),
      Picked: ({ value }) => options.onPick(value),
      Highlighted: () => undefined,
      RequestedQuery: () => undefined,
      Settled: () => undefined
    },
    view: (parts) =>
      h.div.class("inline-block").children(
        parts.trigger({ element: h.button.attrs({ type: "button" }).class("inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm font-medium") }).children(options.triggerLabel),
        parts.positioner(h.div).children(
          parts.popup(h.div.class(menuPopupClass(options.className))).children(
            ...options.items.map((item) =>
              parts.item({ element: h.div.key(item.value).class(menuItemClass()), value: item.value }).children(item.label)
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
    name: "context-menu",
    title: "Context Menu",
    category: "layout",
    description: "Styled right-click context menu wrapping @effect/ui-kit ContextMenu.",
    registryDependencies: ["dropdown-menu"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "contextMenu.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { ContextMenu } from "@effect/ui-kit"
import { menuItemClass, menuPopupClass, type StyledMenuAction } from "./dropdownMenu.js"

export {
  menuItemClass as contextMenuItemClass,
  menuPopupClass as contextMenuPopupClass,
  menuSeparatorClass as contextMenuSeparatorClass
} from "./dropdownMenu.js"

export const styledContextMenu = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly open: boolean
    readonly items: ReadonlyArray<StyledMenuAction>
    readonly target: View.Content<Msg>
    readonly onOpenChange: (open: boolean) => Msg
    readonly onPick: (value: string) => Msg
  }
) =>
  ContextMenu(h, {
    key: options.key ?? "context-menu",
    props: { open: options.open, items: options.items },
    onEmit: {
      RequestedOpen: () => options.onOpenChange(true),
      RequestedClose: () => options.onOpenChange(false),
      Picked: ({ value }) => options.onPick(value),
      Highlighted: () => undefined,
      Settled: () => undefined
    },
    view: (parts) =>
      h.div.children(
        parts.trigger(h.div.class("rounded-md border border-dashed border-border p-4 text-sm")).children(options.target),
        parts.positioner(h.div).children(
          parts.popup(h.div.class(menuPopupClass())).children(
            ...options.items.map((item) =>
              parts.item({ element: h.div.key(item.value).class(menuItemClass()), value: item.value }).children(item.label)
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
    name: "menubar",
    title: "Menubar",
    category: "layout",
    description: "Styled horizontal application menubar wrapping @effect/ui-kit Menubar.",
    registryDependencies: ["cn", "dropdown-menu"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "menubar.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { Menubar } from "@effect/ui-kit"
import { cn } from "./cn.js"
export { menuItemClass, menuPopupClass } from "./dropdownMenu.js"

export const menubarRootClass = (className?: string): string =>
  cn("inline-flex h-9 items-center gap-1 rounded-md border border-border bg-surface p-1 text-sm", className)

export const menubarTriggerClass = (className?: string): string =>
  cn(
    "rounded-sm px-2.5 py-1 text-sm font-medium text-foreground outline-none",
    "hover:bg-muted data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground",
    className
  )

export const styledMenubar = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly menus: ReadonlyArray<View.Content<Msg>>
    readonly className?: string | undefined
  }
) =>
  Menubar(h, {
    key: options.key ?? "menubar",
    props: {},
    view: (parts) =>
      parts.root(h.div.class(menubarRootClass(options.className))).children(...options.menus)
  })
`
      }
    ]
  },
  {
    name: "navigation-menu",
    title: "Navigation Menu",
    category: "layout",
    description: "Styled top-level site navigation bar wrapping @effect/ui-kit NavigationMenu.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "navigationMenu.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { NavigationMenu } from "@effect/ui-kit"
import { cn } from "./cn.js"

export const navigationMenuListClass = (className?: string): string =>
  cn("flex list-none items-center gap-1", className)

export const navigationMenuTriggerClass = (className?: string): string =>
  cn(
    "inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium text-foreground transition-colors",
    "hover:bg-muted data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground",
    className
  )

export const navigationMenuPopupClass = (className?: string): string =>
  cn("z-50 rounded-lg border border-border bg-surface p-4 text-foreground shadow-lg", className)

export interface StyledNavSection<Msg> {
  readonly value: string
  readonly label: string
  readonly content: View.Content<Msg>
}

export const styledNavigationMenu = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly value: string | null
    readonly sections: ReadonlyArray<StyledNavSection<Msg>>
    readonly onValueChange: (value: string | null) => Msg
    readonly className?: string | undefined
  }
) =>
  NavigationMenu(h, {
    key: options.key ?? "navigation-menu",
    props: { value: options.value },
    onEmit: {
      RequestedOpen: ({ value }) => options.onValueChange(value),
      RequestedClose: () => options.onValueChange(null),
      Settled: () => undefined
    },
    view: (parts) => {
      const active = options.sections.find((s) => s.value === parts.value)
      return parts.root(h.nav.attrs({ "aria-label": "Main navigation" }).class(cn("relative", options.className))).children(
        parts.list(h.ul.class(navigationMenuListClass())).children(
          ...options.sections.map((section) =>
            parts.item(h.li.key(section.value)).children(
              parts.trigger({
                element: h.button.attrs({ type: "button" }).class(navigationMenuTriggerClass()),
                value: section.value
              }).children(section.label)
            )
          )
        ),
        parts.portal(h.div)?.children(
          parts.positioner(h.div.key("pos")).children(
            parts.popup(h.div.class(navigationMenuPopupClass())).children(
              parts.viewport(h.div).children(active !== undefined ? active.content : "")
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
    name: "toast",
    title: "Toast",
    category: "layout",
    description: "Styled top-layer toast viewport and cards wrapping @effect/ui-kit ToastProvider.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "toast.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { ToastProvider } from "@effect/ui-kit"
import { cn } from "./cn.js"

export const toastViewportClass = (className?: string): string =>
  cn("fixed right-4 bottom-4 z-50 m-0 flex w-full max-w-sm flex-col gap-2 border-0 bg-transparent p-0", className)

export const toastCardClass = (className?: string): string =>
  cn(
    "flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4 text-sm text-foreground shadow-md",
    "data-[type=error]:border-destructive/60 transition-all duration-150 data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
    className
  )

export const styledToastProvider = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly body: View.Content<Msg>
    readonly onDismiss?: ((id: string) => Msg) | undefined
    readonly className?: string | undefined
  }
) =>
  ToastProvider(h, {
    key: options.key ?? "toast-provider",
    props: {},
    onEmit: {
      Dismissed: ({ id }) => (options.onDismiss ? options.onDismiss(id) : undefined)
    },
    view: (parts) =>
      h.div.children(
        options.body,
        parts.viewport(h.div.class(toastViewportClass(options.className))).children(
          ...parts.toasts.map((toast) =>
            parts.root({ element: h.div.key(toast.id).class(toastCardClass()), toast }).children(
              parts.content({ element: h.div.class("flex-1"), toast }).children(
                ...(toast.title !== undefined ? [parts.title({ element: h.div.class("font-semibold"), toast }).children(toast.title)] : []),
                ...(toast.description !== undefined ? [parts.description({ element: h.div.class("text-xs text-muted-foreground"), toast }).children(toast.description)] : [])
              ),
              parts.close({ element: h.button.attrs({ type: "button", "aria-label": "Dismiss notification" }).class("text-xs text-muted-foreground hover:text-foreground"), toast }).children("✕")
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
    name: "sonner",
    title: "Sonner Stack",
    category: "layout",
    description: "Stacked toast deck wrapping @effect/ui-kit ToastProvider with Sonner styling.",
    registryDependencies: ["cn", "toast"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "sonner.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { ToastProvider } from "@effect/ui-kit"
import { cn } from "./cn.js"
import { toastCardClass, toastViewportClass } from "./toast.js"

export const sonnerViewportClass = (className?: string): string =>
  toastViewportClass(cn("gap-2.5", className))

export const sonnerToastClass = (className?: string): string =>
  toastCardClass(cn("data-[behind]:scale-[0.96] data-[behind]:opacity-85 data-[expanded]:scale-100 data-[expanded]:opacity-100", className))

export const styledSonnerToaster = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly body: View.Content<Msg>
    readonly limit?: number | undefined
    readonly onDismiss?: ((id: string) => Msg) | undefined
  }
) =>
  ToastProvider(h, {
    key: options.key ?? "sonner-toaster",
    props: { ...(options.limit !== undefined ? { limit: options.limit } : {}) },
    onEmit: {
      Dismissed: ({ id }) => (options.onDismiss ? options.onDismiss(id) : undefined)
    },
    view: (parts) =>
      h.div.children(
        options.body,
        parts.viewport(h.div.class(sonnerViewportClass())).children(
          ...parts.toasts.map((toast) =>
            parts.root({ element: h.div.key(toast.id).class(sonnerToastClass()), toast }).children(
              parts.content({ element: h.div.class("flex-1"), toast }).children(
                ...(toast.title !== undefined ? [parts.title({ element: h.div.class("font-semibold"), toast }).children(toast.title)] : []),
                ...(toast.description !== undefined ? [parts.description({ element: h.div.class("text-xs text-muted-foreground"), toast }).children(toast.description)] : [])
              ),
              parts.close({ element: h.button.attrs({ type: "button", "aria-label": "Close toast" }).class("text-xs text-muted-foreground"), toast }).children("✕")
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
    name: "command",
    title: "Command Palette",
    category: "layout",
    description: "Styled command palette wrapping Command from effect-ui-extra/widgets.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "effect-ui-extra"],
    files: [
      {
        path: "command.ts",
        content: `import type { Html } from "@effect/ui/html"
import { Command, type CommandProps } from "effect-ui-extra/widgets"
import { cn } from "./cn.js"

export const commandDialogClass = (className?: string): string =>
  cn("w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface text-foreground shadow-lg", className)

export const commandInputClass = (className?: string): string =>
  cn("h-11 w-full border-b border-border bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground", className)

export const commandItemClass = (className?: string): string =>
  cn(
    "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm",
    "aria-[selected=true]:bg-accent aria-[selected=true]:text-accent-foreground",
    className
  )

export const styledCommand = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly props: CommandProps
    readonly onSelect: (value: string) => Msg
    readonly onClose: Msg
    readonly onOpen?: Msg | undefined
    readonly className?: string | undefined
  }
) =>
  h.div.class(commandDialogClass(options.className)).children(
    Command(h, {
      key: options.key ?? "command",
      props: options.props,
      onEmit: {
        Selected: ({ value }) => options.onSelect(value),
        RequestedClose: () => options.onClose,
        RequestedOpen: () => options.onOpen
      }
    })
  )
`
      }
    ]
  },
  {
    name: "dialog",
    title: "Dialog",
    category: "layout",
    description: "Styled modal dialog wrapping @effect/ui-kit Dialog with overlay backdrop and accessible title.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "dialog.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { Dialog } from "@effect/ui-kit"
import { cn } from "./cn.js"

export const dialogSurfaceClass = (className?: string): string =>
  cn(
    "m-auto w-full max-w-lg rounded-xl border border-border bg-background p-6 text-foreground shadow-xl backdrop:bg-foreground/40",
    className
  )

export const renderDialog = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly open: boolean
    readonly title: string
    readonly description?: string | undefined
    readonly triggerLabel: string
    readonly onOpen: Msg
    readonly onClose: Msg
    readonly body: View.Content<Msg>
    readonly footer?: View.Content<Msg> | undefined
  }
) =>
  Dialog(h, {
    key: options.key ?? "dialog",
    props: { open: options.open },
    onEmit: {
      RequestedOpen: () => options.onOpen,
      RequestedClose: () => options.onClose,
      Settled: () => undefined
    },
    view: (parts) =>
      h.div.attrs({ "data-dialog-root": "" }).children(
        parts
          .trigger(h.button.attrs({ type: "button" }).class("inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium"))
          .children(options.triggerLabel),
        parts.portal(
          h.dialog.class("fixed inset-0 m-0 max-h-none max-w-none bg-transparent p-0")
        )?.children(
          parts.backdrop(
            h.div.class("fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0")
          ),
          parts.popup(h.div.class(cn("fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2", dialogSurfaceClass()))).children(
            parts.title(h.h2.class("text-lg font-semibold")).children(options.title),
            ...(options.description !== undefined
              ? [parts.description(h.p.class("mt-1 text-sm text-muted-foreground")).children(options.description)]
              : []),
            h.div.class("mt-4").children(options.body),
            ...(options.footer !== undefined ? [h.div.class("mt-5 flex justify-end gap-2").children(options.footer)] : [])
          )
        )
      )
  })
`
      }
    ]
  }
]
