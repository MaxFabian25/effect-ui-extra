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
    description: "Styled bottom/side swipeable drawer classes wired to @effect/ui-kit Drawer CSS variables.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "drawer.ts",
        content: `import { cn } from "./cn.js"

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
`
      }
    ]
  },
  {
    name: "popover",
    title: "Popover",
    category: "layout",
    description: "Styled floating popover surface and arrow classes for @effect/ui-kit Popover.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "popover.ts",
        content: `import { cn } from "./cn.js"

export const popoverPopupClass = (className?: string): string =>
  cn(
    "z-50 w-72 rounded-md border border-border bg-surface p-4 text-sm text-foreground shadow-md",
    "transition-all duration-150 origin-[var(--transform-origin)] data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
    className
  )

export const popoverArrowClass = (className?: string): string =>
  cn("h-2.5 w-2.5 rotate-45 border border-border bg-surface", className)
`
      }
    ]
  },
  {
    name: "tooltip",
    title: "Tooltip",
    category: "layout",
    description: "Styled compact floating tooltip bubble classes for @effect/ui-kit Tooltip.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "tooltip.ts",
        content: `import { cn } from "./cn.js"

export const tooltipPopupClass = (className?: string): string =>
  cn(
    "z-50 max-w-xs rounded-sm bg-foreground px-2.5 py-1 text-xs font-medium text-background shadow-sm",
    "transition-all duration-120 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
    className
  )
`
      }
    ]
  },
  {
    name: "hover-card",
    title: "Hover Card",
    category: "layout",
    description: "Styled preview card popup classes for @effect/ui-kit PreviewCard.",
    registryDependencies: ["cn", "popover"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "hoverCard.ts",
        content: `import { popoverPopupClass } from "./popover.js"

export const hoverCardPopupClass = (className?: string): string =>
  popoverPopupClass(className)
`
      }
    ]
  },
  {
    name: "dropdown-menu",
    title: "Dropdown Menu",
    category: "layout",
    description: "Styled popup, item, separator, and shortcut classes for @effect/ui-kit Menu.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "dropdownMenu.ts",
        content: `import { cn } from "./cn.js"

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
`
      }
    ]
  },
  {
    name: "context-menu",
    title: "Context Menu",
    category: "layout",
    description: "Styled right-click context menu classes sharing dropdown-menu tokens.",
    registryDependencies: ["dropdown-menu"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "contextMenu.ts",
        content: `export {
  menuItemClass as contextMenuItemClass,
  menuPopupClass as contextMenuPopupClass,
  menuSeparatorClass as contextMenuSeparatorClass
} from "./dropdownMenu.js"
`
      }
    ]
  },
  {
    name: "menubar",
    title: "Menubar",
    category: "layout",
    description: "Styled desktop-style horizontal application menubar classes for @effect/ui-kit Menubar.",
    registryDependencies: ["cn", "dropdown-menu"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "menubar.ts",
        content: `import { cn } from "./cn.js"
export { menuItemClass, menuPopupClass } from "./dropdownMenu.js"

export const menubarRootClass = (className?: string): string =>
  cn("inline-flex h-9 items-center gap-1 rounded-md border border-border bg-surface p-1 text-sm", className)

export const menubarTriggerClass = (className?: string): string =>
  cn(
    "rounded-sm px-2.5 py-1 text-sm font-medium text-foreground outline-none",
    "hover:bg-muted data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground",
    className
  )
`
      }
    ]
  },
  {
    name: "navigation-menu",
    title: "Navigation Menu",
    category: "layout",
    description: "Styled top-level site navigation bar, triggers, and viewport classes for @effect/ui-kit NavigationMenu.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "navigationMenu.ts",
        content: `import { cn } from "./cn.js"

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
`
      }
    ]
  },
  {
    name: "toast",
    title: "Toast",
    category: "layout",
    description: "Styled top-layer toast stack viewport and notification card classes for @effect/ui-kit ToastProvider.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "toast.ts",
        content: `import { cn } from "./cn.js"

export const toastViewportClass = (className?: string): string =>
  cn("fixed right-4 bottom-4 z-50 m-0 flex w-full max-w-sm flex-col gap-2 border-0 bg-transparent p-0", className)

export const toastCardClass = (className?: string): string =>
  cn(
    "flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4 text-sm text-foreground shadow-md",
    "data-[type=error]:border-destructive/60 transition-all duration-150 data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
    className
  )
`
      }
    ]
  },
  {
    name: "sonner",
    title: "Sonner Stack",
    category: "layout",
    description: "Stacked toast deck styling matching Sonner's collapsed/expanded CSS variable layout on @effect/ui-kit ToastProvider.",
    registryDependencies: ["cn", "toast"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "sonner.ts",
        content: `import { cn } from "./cn.js"
import { toastCardClass, toastViewportClass } from "./toast.js"

export const sonnerViewportClass = (className?: string): string =>
  toastViewportClass(cn("gap-2.5", className))

export const sonnerToastClass = (className?: string): string =>
  toastCardClass(cn("data-[behind]:scale-[0.96] data-[behind]:opacity-85 data-[expanded]:scale-100 data-[expanded]:opacity-100", className))
`
      }
    ]
  },
  {
    name: "command",
    title: "Command Palette",
    category: "layout",
    description: "Styled command palette dialog shell pairing with Command from effect-ui-extra/widgets.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "effect-ui-extra"],
    files: [
      {
        path: "command.ts",
        content: `import { cn } from "./cn.js"

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
