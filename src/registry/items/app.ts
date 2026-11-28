import type { RegistryItem } from "../schema.js"

/**
 * Application chrome and data components (`dialog-card`, `sheet`, `sidebar`,
 * `data-table`, `chart`) copied into user repos as self-contained Effect UI
 * modules.
 */
export const APP_REGISTRY_ITEMS: ReadonlyArray<RegistryItem> = [
  {
    name: "dialog-card",
    title: "Dialog Card",
    category: "layout",
    description: "Styled accessible modal dialog wrapping @effect/ui-kit Dialog with starting/ending CSS transitions.",
    registryDependencies: ["cn", "button"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "dialogCard.ts",
        content: `import type { View } from "@effect/ui"
import { Dialog } from "@effect/ui-kit"
import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"
import { buttonClass } from "./button.js"

export const dialogCard = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly open: boolean
    readonly title: string
    readonly description?: string | undefined
    readonly onOpenChange: (open: boolean) => Msg
    readonly triggerLabel?: string | undefined
    readonly body: View.Content<Msg> | string
    readonly footer?: View.Content<Msg> | string | undefined
    readonly className?: string | undefined
  }
) =>
  Dialog(h, {
    key: options.key ?? "dialog",
    props: { open: options.open },
    onEmit: {
      RequestedOpen: () => options.onOpenChange(true),
      RequestedClose: () => options.onOpenChange(false),
      Settled: () => undefined
    },
    view: (parts) =>
      h.div.attrs({ "data-dialog-root": "" }).children(
        ...(options.triggerLabel !== undefined
          ? [parts.trigger(h.button.class(buttonClass({ variant: "outline" }))).children(options.triggerLabel)]
          : []),
        parts.portal(
          h.dialog.class("fixed inset-0 m-0 max-h-none max-w-none bg-transparent p-0")
        )?.children(
            parts.backdrop(
              h.div.class(
                "fixed inset-0 z-[var(--z-modal,200)] bg-black/50 transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
              )
            ),
            parts.popup(
              h.div.class(
                cn(
                  "fixed left-1/2 top-1/2 z-[var(--z-modal,200)] w-full max-w-[min(32rem,calc(100dvw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 text-foreground shadow-lg dark:shadow-none",
                  "transition-[transform,opacity] duration-150 ease-[var(--ease-eui,ease-out)] data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.99] data-[ending-style]:opacity-0 data-[ending-style]:duration-100 motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100",
                  options.className
                )
              )
            ).children(
              parts.title(h.h2.class("text-lg font-semibold leading-tight text-balance")).children(options.title),
              ...(options.description !== undefined
                ? [parts.description(h.p.class("mt-1.5 text-sm text-muted-foreground text-pretty")).children(options.description)]
                : []),
              h.div.class("mt-4").children(options.body),
              ...(options.footer !== undefined
                ? [h.div.class("mt-5 flex items-center justify-end gap-2").children(options.footer)]
                : [])
            )
          )
      )
  })
`
      }
    ]
  },
  {
    name: "sheet",
    title: "Sheet",
    category: "layout",
    description: "Styled edge-docked side panel built on @effect/ui-kit Dialog with left, right, top, and bottom placements.",
    registryDependencies: ["cn", "button"],
    dependencies: ["@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "sheet.ts",
        content: `import type { View } from "@effect/ui"
import { Dialog } from "@effect/ui-kit"
import type { Html } from "@effect/ui/html"
import { buttonClass } from "./button.js"
import { cn } from "./cn.js"
import { uiIcon } from "./icons.js"

export type SheetSide = "left" | "right" | "top" | "bottom"

const SIDE_CLASSES: Readonly<Record<SheetSide, string>> = {
  right: "inset-y-0 right-0 h-dvh w-full max-w-[min(24rem,calc(100dvw-2rem))] border-s data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full motion-reduce:data-[starting-style]:translate-x-0 motion-reduce:data-[ending-style]:translate-x-0",
  left: "inset-y-0 left-0 h-dvh w-full max-w-[min(24rem,calc(100dvw-2rem))] border-e data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full motion-reduce:data-[starting-style]:translate-x-0 motion-reduce:data-[ending-style]:translate-x-0",
  top: "inset-x-0 top-0 max-h-[85dvh] w-full border-b data-[starting-style]:-translate-y-full data-[ending-style]:-translate-y-full motion-reduce:data-[starting-style]:translate-y-0 motion-reduce:data-[ending-style]:translate-y-0",
  bottom: "inset-x-0 bottom-0 max-h-[85dvh] w-full border-t pb-[max(1.5rem,env(safe-area-inset-bottom))] data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full motion-reduce:data-[starting-style]:translate-y-0 motion-reduce:data-[ending-style]:translate-y-0"
}

export const sheet = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly key?: string | undefined
    readonly open: boolean
    readonly side?: SheetSide | undefined
    readonly title: string
    readonly description?: string | undefined
    readonly onOpenChange: (open: boolean) => Msg
    readonly body: View.Content<Msg> | string
    readonly className?: string | undefined
  }
) => {
  const side = options.side ?? "right"
  return Dialog(h, {
    key: options.key ?? "sheet",
    props: { open: options.open },
    onEmit: {
      RequestedOpen: () => options.onOpenChange(true),
      RequestedClose: () => options.onOpenChange(false),
      Settled: () => undefined
    },
    view: (parts) =>
      h.div.attrs({ "data-sheet-root": "" }).children(
        parts.portal(
          h.dialog.class("fixed inset-0 m-0 max-h-none max-w-none bg-transparent p-0")
        )?.children(
          parts.backdrop(
            h.div.class(
              "fixed inset-0 z-[var(--z-modal,200)] bg-black/50 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
            )
          ),
          parts.popup(
            h.div.class(
              cn(
                "fixed z-[var(--z-modal,200)] flex flex-col gap-4 border-border bg-surface p-6 text-foreground shadow-lg dark:shadow-none",
                "transition-[transform,opacity] duration-250 ease-[var(--ease-sheet,cubic-bezier(0.32,0.72,0,1))] data-[ending-style]:duration-150 motion-reduce:data-[starting-style]:opacity-0 motion-reduce:data-[ending-style]:opacity-0",
                SIDE_CLASSES[side],
                options.className
              )
            )
          ).children(
            h.div.class("flex items-start justify-between gap-2").children(
              h.div.children(
                parts.title(h.h2.class("text-base font-semibold text-balance")).children(options.title),
                ...(options.description !== undefined
                  ? [parts.description(h.p.class("mt-1 text-sm text-muted-foreground text-pretty")).children(options.description)]
                  : [])
              ),
              parts.close(
                h.button
                  .class(buttonClass({ variant: "ghost", size: "sm", className: "min-h-8 min-w-8 shrink-0 px-2" }))
                  .attrs({ type: "button", "aria-label": "Close sheet" })
              ).children(uiIcon(h, "close", 14), h.span.class("sr-only").children("Close"))
            ),
            h.div.class("min-h-0 flex-1 overflow-y-auto overscroll-contain").children(options.body)
          )
        )
      )
  })
}
`
      }
    ]
  },
  {
    name: "sidebar",
    title: "Sidebar Shell",
    category: "layout",
    description: "Collapsible application sidebar with state toggle, keyboard shortcut hint, navigation groups, and main inset.",
    registryDependencies: ["cn", "kbd"],
    dependencies: ["@effect/ui", "effect"],
    files: [
      {
        path: "sidebar.ts",
        content: `import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { cn } from "./cn.js"
import { uiIcon } from "./icons.js"
import { kbd } from "./kbd.js"

export const SidebarItemSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  href: Schema.String,
  badge: Schema.optional(Schema.String)
})
export type SidebarItem = typeof SidebarItemSchema.Type

export const SidebarGroupSchema = Schema.Struct({
  label: Schema.String,
  items: Schema.Array(SidebarItemSchema)
})
export type SidebarGroup = typeof SidebarGroupSchema.Type

export const SidebarProps = Schema.Struct({
  title: Schema.String,
  groups: Schema.Array(SidebarGroupSchema),
  activeId: Schema.optional(Schema.String),
  defaultCollapsed: Schema.optional(Schema.Boolean),
  shortcutLabel: Schema.optional(Schema.String)
})
export type SidebarProps = typeof SidebarProps.Type

export const SidebarEvents = UiSchema.TaggedEnum({
  Toggled: { collapsed: Schema.Boolean },
  Selected: { id: Schema.String }
})
export type SidebarEvents = typeof SidebarEvents.Type

const SidebarMsg = UiSchema.TaggedEnum({
  Toggle: {},
  Select: { id: Schema.String }
})

export const Sidebar = Html.component({
  name: "Sidebar",
  props: SidebarProps,
  model: Schema.Struct({ collapsed: Schema.Boolean }),
  message: SidebarMsg,
  events: SidebarEvents
}).make({
  init: ($) => ({ collapsed: $.props.defaultCollapsed ?? false }),
  update: {
    Toggle: ($) => {
      const collapsed = !$.model.collapsed
      return $.evolve({ collapsed }).emit(SidebarEvents.Toggled({ collapsed }))
    },
    Select: ($, { id }) => $.emit(SidebarEvents.Selected({ id }))
  },
  view: (h, model) => {
    const p = h.props
    const shortcut = p.shortcutLabel ?? "Ctrl+B"
    return h.aside
      .attrs({
        "aria-label": p.title,
        "data-sidebar": "",
        "data-state": model.collapsed ? "collapsed" : "expanded"
      })
      .class(
        cn(
          "flex shrink-0 flex-col border-b md:border-b-0 md:border-e border-border bg-surface text-foreground",
          model.collapsed ? "w-full md:w-14" : "w-full md:w-60"
        )
      )
      .children(
        h.div.class("flex items-center justify-between gap-2 border-b border-border px-3 py-3").children(
          ...(model.collapsed ? [] : [h.span.attrs({ title: p.title }).class("truncate text-sm font-semibold").children(p.title)]),
          h.button
            .attrs({
              type: "button",
              "aria-label": model.collapsed ? "Expand sidebar" : "Collapse sidebar",
              "aria-expanded": String(!model.collapsed)
            })
            .class("inline-flex min-h-8 min-w-8 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs text-muted-foreground touch-manipulation select-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")
            .on("click", () => SidebarMsg.Toggle())
            .children(
              uiIcon(h, model.collapsed ? "chevronRight" : "chevronLeft", 14),
              ...(model.collapsed ? [] : [kbd(h, shortcut)])
            )
        ),
        h.nav
          .attrs({ "aria-label": \`\${p.title} navigation\` })
          .class("flex-1 space-y-4 overflow-y-auto overscroll-contain p-2")
          .children(
            ...p.groups.map((group) =>
              h.div
                .key(group.label)
                .class("space-y-1")
                .children(
                  ...(model.collapsed
                    ? []
                    : [
                        h.div
                          .class("px-2.5 py-1 text-xs font-medium text-muted-foreground")
                          .children(group.label)
                      ]),
                  ...group.items.map((item) => {
                    const active = item.id === p.activeId
                    return h.a
                      .key(item.id)
                      .attrs({
                        href: item.href,
                        title: item.label,
                        ...(active ? { "aria-current": "page" } : {}),
                        "aria-label": item.label
                      })
                      .class(
                        cn(
                          "flex min-h-9 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                          model.collapsed ? "justify-center px-1.5" : "",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )
                      )
                      .on("click", () => SidebarMsg.Select({ id: item.id }))
                      .children(
                        h.span.class("truncate").children(model.collapsed ? item.label.slice(0, 1) : item.label),
                        ...(!model.collapsed && item.badge !== undefined
                          ? [h.span.class("rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-foreground").children(item.badge)]
                          : [])
                      )
                  })
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
    name: "data-table",
    title: "Data Table",
    category: "data",
    description: "Typed sortable, filterable, paginated, row-selectable DataTable built for Effect UI apps.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "effect", "effect-ui-extra"],
    files: [
      {
        path: "dataTable.ts",
        content: `import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { buildPaginationRange } from "effect-ui-extra/widgets"
import { cn } from "./cn.js"
import { uiIcon } from "./icons.js"

export const DataTableColumnSchema = Schema.Struct({
  key: Schema.String,
  header: Schema.String,
  sortable: Schema.optional(Schema.Boolean)
})
export type DataTableColumn = typeof DataTableColumnSchema.Type

export const DataTableRowSchema = Schema.Struct({
  id: Schema.String,
  cells: Schema.Record(Schema.String, Schema.String)
})
export type DataTableRow = typeof DataTableRowSchema.Type

export type SortDirection = "asc" | "desc"

export interface DataTableViewState {
  readonly query: string
  readonly sortKey: string | null
  readonly sortDir: SortDirection
  readonly page: number
  readonly pageSize: number
  readonly selectedIds: ReadonlyArray<string>
  readonly hiddenColumns: ReadonlyArray<string>
}

export const filterAndSortRows = (
  rows: ReadonlyArray<DataTableRow>,
  state: Pick<DataTableViewState, "query" | "sortKey" | "sortDir">
): ReadonlyArray<DataTableRow> => {
  const q = state.query.trim().toLowerCase()
  const filtered =
    q.length === 0
      ? rows
      : rows.filter((row) =>
          Object.values(row.cells).some((cell) => cell.toLowerCase().includes(q))
        )
  if (state.sortKey === null) return filtered
  const key = state.sortKey
  const mul = state.sortDir === "asc" ? 1 : -1
  return [...filtered].sort((a, b) =>
    (a.cells[key] ?? "").localeCompare(b.cells[key] ?? "", undefined, { numeric: true }) * mul
  )
}

export const DataTableProps = Schema.Struct({
  label: Schema.String,
  columns: Schema.Array(DataTableColumnSchema),
  rows: Schema.Array(DataTableRowSchema),
  pageSize: Schema.optional(Schema.Number),
  selectable: Schema.optional(Schema.Boolean),
  searchable: Schema.optional(Schema.Boolean)
})
export type DataTableProps = typeof DataTableProps.Type

export const DataTableEvents = UiSchema.TaggedEnum({
  SelectionChanged: { selectedIds: Schema.Array(Schema.String) }
})
export type DataTableEvents = typeof DataTableEvents.Type

const DataTableMsg = UiSchema.TaggedEnum({
  QueryChanged: { query: Schema.String },
  ToggleSort: { key: Schema.String },
  SetPage: { page: Schema.Number },
  ToggleRow: { id: Schema.String },
  ToggleAllPage: { ids: Schema.Array(Schema.String) },
  ToggleColumn: { key: Schema.String }
})

export const DataTable = Html.component({
  name: "DataTable",
  props: DataTableProps,
  model: Schema.Struct({
    query: Schema.String,
    sortKey: Schema.NullOr(Schema.String),
    sortDir: Schema.Literals(["asc", "desc"]),
    page: Schema.Number,
    selectedIds: Schema.Array(Schema.String),
    hiddenColumns: Schema.Array(Schema.String)
  }),
  message: DataTableMsg,
  events: DataTableEvents
}).make({
  init: () => ({
    query: "",
    sortKey: null,
    sortDir: "asc" as const,
    page: 1,
    selectedIds: [],
    hiddenColumns: []
  }),
  update: {
    QueryChanged: ($, { query }) => $.evolve({ query, page: 1 }),
    ToggleSort: ($, { key }) => {
      if ($.model.sortKey !== key) return $.evolve({ sortKey: key, sortDir: "asc" as const, page: 1 })
      if ($.model.sortDir === "asc") return $.evolve({ sortDir: "desc" as const, page: 1 })
      return $.evolve({ sortKey: null, sortDir: "asc" as const, page: 1 })
    },
    SetPage: ($, { page }) => $.evolve({ page: Math.max(1, Math.floor(page)) }),
    ToggleRow: ($, { id }) => {
      const exists = $.model.selectedIds.includes(id)
      const selectedIds = exists
        ? $.model.selectedIds.filter((x) => x !== id)
        : [...$.model.selectedIds, id]
      return $.evolve({ selectedIds }).emit(DataTableEvents.SelectionChanged({ selectedIds }))
    },
    ToggleAllPage: ($, { ids }) => {
      const allSelected = ids.every((id) => $.model.selectedIds.includes(id))
      const selectedIds = allSelected
        ? $.model.selectedIds.filter((id) => !ids.includes(id))
        : Array.from(new Set([...$.model.selectedIds, ...ids]))
      return $.evolve({ selectedIds }).emit(DataTableEvents.SelectionChanged({ selectedIds }))
    },
    ToggleColumn: ($, { key }) => {
      const hiddenColumns = $.model.hiddenColumns.includes(key)
        ? $.model.hiddenColumns.filter((k) => k !== key)
        : [...$.model.hiddenColumns, key]
      return $.evolve({ hiddenColumns })
    }
  },
  view: (h, model) => {
    const p = h.props
    const pageSize = Math.max(1, Math.floor(p.pageSize ?? 10))
    const processed = filterAndSortRows(p.rows, model)
    const totalPages = Math.max(1, Math.ceil(processed.length / pageSize))
    const page = Math.min(model.page, totalPages)
    const pageRows = processed.slice((page - 1) * pageSize, page * pageSize)
    const visibleCols = p.columns.filter((c) => !model.hiddenColumns.includes(c.key))
    const pageIds = pageRows.map((r) => r.id)
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => model.selectedIds.includes(id))
    const paginationTokens = buildPaginationRange({ page, totalPages })

    return h.div
      .attrs({ "data-data-table": "" })
      .class("flex flex-col gap-3")
      .children(
        ...(p.searchable !== false
          ? [
              h.div.class("flex flex-wrap items-center justify-between gap-2").children(
                h.input
                  .attrs({
                    type: "search",
                    "aria-label": \`Filter \${p.label}\`,
                    placeholder: \`Filter \${p.label.toLowerCase()}…\`,
                    autocomplete: "off",
                    spellcheck: "false",
                    enterkeyhint: "search"
                  })
                  .class("min-h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-base md:text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring")
                  .value(model.query)
                  .on("input", ({ value }) => DataTableMsg.QueryChanged({ query: value })),
                h.span.class("text-xs tabular-nums text-muted-foreground").children(
                  \`\${processed.length} \${processed.length === 1 ? "row" : "rows"}\`
                )
              )
            ]
          : []),
        h.div.class("overflow-x-auto rounded-md border border-border bg-background").children(
          h.table
            .attrs({ "aria-label": p.label })
            .class("w-full border-collapse text-start text-sm")
            .children(
              h.thead.class("border-b border-border bg-surface text-xs font-medium text-muted-foreground").children(
                h.tr.children(
                  ...(p.selectable === true
                    ? [
                        h.th.class("w-12 px-3 py-2.5").children(
                          h.input
                            .attrs({
                              type: "checkbox",
                              "aria-label": "Select all rows on page",
                              ...(allPageSelected ? { checked: "" } : {})
                            })
                            .class("h-6 w-6 min-h-6 min-w-6 cursor-pointer align-middle accent-primary")
                            .on("change", () => DataTableMsg.ToggleAllPage({ ids: pageIds }))
                        )
                      ]
                    : []),
                  ...visibleCols.map((col) => {
                    const isSorted = model.sortKey === col.key
                    const ariaSort = isSorted
                      ? model.sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                    return h.th
                      .key(col.key)
                      .attrs(col.sortable !== false ? { "aria-sort": ariaSort } : {})
                      .class("px-3 py-2 font-medium")
                      .children(
                        col.sortable !== false
                          ? h.button
                              .attrs({ type: "button" })
                              .class("inline-flex min-h-8 min-w-8 items-center gap-1.5 rounded-xs px-1.5 -mx-1.5 text-start touch-manipulation select-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")
                              .on("click", () => DataTableMsg.ToggleSort({ key: col.key }))
                              .children(
                                col.header,
                                h.span.class("inline-flex h-4 w-4 shrink-0 items-center justify-center").children(
                                  uiIcon(
                                    h,
                                    isSorted ? (model.sortDir === "asc" ? "chevronUp" : "chevronDown") : "arrowUpDown",
                                    14
                                  )
                                )
                              )
                          : col.header
                      )
                  })
                )
              ),
              h.tbody.class("divide-y divide-border").children(
                ...(pageRows.length === 0
                  ? [
                      h.tr.key("empty").children(
                        h.td
                          .attrs({ colSpan: String(visibleCols.length + (p.selectable === true ? 1 : 0)) })
                          .class("px-4 py-8 text-center text-sm text-muted-foreground")
                          .children(
                            model.query.trim().length > 0
                              ? h.div.class("flex flex-col items-center gap-2").children(
                                  h.span.children(\`No rows match "\${model.query.trim()}"\`),
                                  h.button
                                    .attrs({ type: "button" })
                                    .class("min-h-8 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")
                                    .on("click", () => DataTableMsg.QueryChanged({ query: "" }))
                                    .children("Clear filter")
                                )
                              : "No rows to display"
                          )
                      )
                    ]
                  : pageRows.map((row) => {
                      const selected = model.selectedIds.includes(row.id)
                      return h.tr
                        .key(row.id)
                        .class(cn("hover:bg-muted/50", selected && "bg-accent/30"))
                        .children(
                          ...(p.selectable === true
                            ? [
                                h.td.class("px-3 py-2.5").children(
                                  h.input
                                    .attrs({
                                      type: "checkbox",
                                      "aria-label": \`Select row \${row.id}\`,
                                      ...(selected ? { checked: "" } : {})
                                    })
                                    .class("h-6 w-6 min-h-6 min-w-6 cursor-pointer align-middle accent-primary")
                                    .on("change", () => DataTableMsg.ToggleRow({ id: row.id }))
                                )
                              ]
                            : []),
                          ...visibleCols.map((col) =>
                            h.td.key(\`\${row.id}-\${col.key}\`).class("px-3 py-2.5 tabular-nums").children(row.cells[col.key] ?? "")
                          )
                        )
                    }))
              )
            )
        ),
        h.nav
          .attrs({ "aria-label": \`\${p.label} pagination\` })
          .class("flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground")
          .children(
            h.span.class("tabular-nums").children(\`Page \${page} of \${totalPages}\`),
            h.div.class("flex items-center gap-1").children(
              ...paginationTokens.map((tok, idx) =>
                tok === "ellipsis"
                  ? h.span.key(\`e-\${idx}\`).class("px-1.5").children("…")
                  : h.button
                      .key(\`p-\${tok}\`)
                      .attrs({
                        type: "button",
                        ...(tok === page ? { "aria-current": "page" } : {})
                      })
                      .class(
                        cn(
                          "min-h-8 min-w-8 rounded-sm px-2 font-medium tabular-nums touch-manipulation select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                          tok === page
                            ? "border border-transparent bg-primary text-primary-foreground"
                            : "hover:bg-muted hover:text-foreground"
                        )
                      )
                      .on("click", () => DataTableMsg.SetPage({ page: tok }))
                      .children(String(tok))
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
    name: "chart",
    title: "Chart Container",
    category: "data",
    description: "Zero-dependency accessible responsive SVG bar and line chart container bound to theme chart tokens.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "chart.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export interface ChartPoint {
  readonly label: string
  readonly value: number
}

export interface ChartSeries {
  readonly id: string
  readonly label: string
  readonly colorVar?: string | undefined
  readonly points: ReadonlyArray<ChartPoint>
}

export const computeChartScale = (
  series: ReadonlyArray<ChartSeries>
): { readonly min: number; readonly max: number } => {
  const values = series.flatMap((s) => s.points.map((p) => p.value))
  if (values.length === 0) return { min: 0, max: 1 }
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  return { min, max: max === min ? min + 1 : max }
}

/**
 * Pure Effect UI bar chart bound to \`--eui-chart-1..6\` CSS tokens with an
 * accessible figure caption and legend.
 */
export const barChartCard = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly title: string
    readonly series: ReadonlyArray<ChartSeries>
    readonly className?: string | undefined
  }
) => {
  const scale = computeChartScale(options.series)
  const range = Math.max(1e-6, scale.max - scale.min)
  const firstSeries = options.series[0]
  const labels = firstSeries?.points.map((p) => p.label) ?? []

  return h.figure
    .attrs({ role: "group", "aria-label": options.title, "data-chart": "" })
    .class(cn("rounded-lg border border-border bg-surface p-4", options.className))
    .children(
      h.figcaption.class("mb-3 flex flex-wrap items-center justify-between gap-2").children(
        h.span.class("text-sm font-semibold text-foreground").children(options.title),
        h.div.class("flex flex-wrap items-center gap-3 text-xs text-muted-foreground").children(
          ...options.series.map((s, idx) =>
            h.span.key(s.id).class("inline-flex items-center gap-1.5").children(
              h.span
                .attrs({ "aria-hidden": "true" })
                .class("inline-block h-2.5 w-2.5 rounded-xs")
                .style({
                  backgroundColor: \`var(\${s.colorVar ?? \`--eui-chart-\${(idx % 6) + 1}\`}, var(--eui-primary))\`,
                  forcedColorAdjust: "none"
                }),
              s.label
            )
          )
        )
      ),
      h.div
        .attrs({ role: "list", "aria-label": \`\${options.title} values\` })
        .class("grid items-end gap-2 pt-2")
        .style({
          gridTemplateColumns: \`repeat(\${Math.max(1, labels.length)}, minmax(0, 1fr))\`,
          height: "160px"
        })
        .children(
          ...labels.map((label, colIdx) =>
            h.div
              .key(\`col-\${colIdx}\`)
              .attrs({ role: "listitem" })
              .class("flex h-full flex-col items-center justify-end gap-1")
              .children(
                h.div.class("flex h-full w-full items-end justify-center gap-1").children(
                  ...options.series.map((s, sIdx) => {
                    const val = s.points[colIdx]?.value ?? 0
                    const pct = Math.max(2, Math.round(((val - scale.min) / range) * 100))
                    return h.div
                      .key(\`\${s.id}-\${colIdx}\`)
                      .attrs({
                        title: \`\${s.label} — \${label}: \${val}\`,
                        "data-value": String(val)
                      })
                      .class("h-full w-full max-w-8 origin-bottom rounded-t-xs transition-transform duration-200 ease-[var(--ease-eui,ease-out)] motion-reduce:transition-none")
                      .style({
                        transform: \`scaleY(\${(pct / 100).toFixed(4)})\`,
                        backgroundColor: \`var(\${s.colorVar ?? \`--eui-chart-\${(sIdx % 6) + 1}\`}, var(--eui-primary))\`,
                        forcedColorAdjust: "none"
                      })
                  })
                ),
                h.span.attrs({ title: label }).class("max-w-full truncate text-xs tabular-nums text-muted-foreground").children(label)
              )
          )
        )
    )
}
`
      }
    ]
  }
]
