import type { RegistryItem } from "../schema.js"

/**
 * Six interactive SVG chart blueprints (`chart-area`, `chart-bar`, `chart-line`,
 * `chart-pie`, `chart-radar`, `chart-radial`) and six page blocks
 * (`block-settings`, `block-signup`, `block-otp`, `block-sidebar-inset`,
 * `block-sidebar-icons`, `block-calendar-presets`) completing shadcn v4
 * gallery parity.
 */
export const CHARTS_AND_EXTRA_BLOCKS: ReadonlyArray<RegistryItem> = [
  {
    name: "chart-area",
    title: "Area Chart",
    category: "data",
    description: "Accessible responsive SVG area chart with gradient fill, gridlines, and token series colors.",
    registryDependencies: ["cn", "chart"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "charts/areaChart.ts",
        content: `import type { Html } from "@effect/ui/html"
import { type ChartSeries, computeChartScale } from "../chart.js"
import { cn } from "../cn.js"

export const areaChart = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly title: string
    readonly series: ReadonlyArray<ChartSeries>
    readonly width?: number | undefined
    readonly height?: number | undefined
    readonly className?: string | undefined
  }
) => {
  const width = options.width ?? 480
  const height = options.height ?? 180
  const pad = 24
  const scale = computeChartScale(options.series)
  const range = Math.max(1e-6, scale.max - scale.min)
  const dashes = ["", "6 3", "2 3", "8 3 2 3"] as const
  const summary = options.series
    .map((s) => \`\${s.label}: \${s.points.map((p) => \`\${p.label} \${p.value}\`).join(", ")}\`)
    .join("; ")

  return h.figure
    .attrs({ role: "group", "aria-label": options.title, "data-chart-area": "" })
    .class(cn("rounded-lg border border-border bg-surface p-4", options.className))
    .children(
      h.figcaption.class("mb-2 flex flex-wrap items-center justify-between gap-2").children(
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
      options.series.length === 0
        ? h.p.class("py-8 text-center text-xs text-muted-foreground").children("No data available")
        : h.svg
            .attrs({ viewBox: \`0 0 \${width} \${height}\`, role: "img", "aria-label": \`\${options.title}: \${summary}\` })
            .class("h-44 w-full overflow-visible")
            .children(
              h.defs.children(
                ...options.series.map((s, sIdx) => {
                  const color = \`var(\${s.colorVar ?? \`--eui-chart-\${(sIdx % 6) + 1}\`}, var(--eui-primary))\`
                  return h.linearGradient
                    .key(\`grad-\${s.id}\`)
                    .attrs({ id: \`eui-area-\${s.id}-\${sIdx}\`, x1: "0", y1: "0", x2: "0", y2: "1" })
                    .children(
                      h.stop.attrs({ offset: "0%", "stop-color": color, "stop-opacity": "0.32" }),
                      h.stop.attrs({ offset: "100%", "stop-color": color, "stop-opacity": "0.02" })
                    )
                })
              ),
              ...[0, 0.5, 1].map((frac, gi) => {
                const gy = pad + frac * (height - pad * 2)
                return h.line.key(\`grid-\${gi}\`).attrs({
                  x1: String(pad),
                  x2: String(width - pad),
                  y1: gy.toFixed(1),
                  y2: gy.toFixed(1),
                  stroke: "var(--eui-border)",
                  "stroke-dasharray": "2 3",
                  "stroke-width": "1"
                })
              }),
              ...options.series.map((s, sIdx) => {
                const count = Math.max(1, s.points.length - 1)
                const coords = s.points.map((p, idx) => {
                  const x = pad + (idx / count) * (width - pad * 2)
                  const y = height - pad - ((p.value - scale.min) / range) * (height - pad * 2)
                  return { x, y }
                })
                const line = coords.map((c, i) => \`\${i === 0 ? "M" : "L"}\${c.x.toFixed(1)},\${c.y.toFixed(1)}\`).join(" ")
                const area = coords.length > 0
                  ? \`\${line} L\${coords[coords.length - 1]!.x.toFixed(1)},\${height - pad} L\${coords[0]!.x.toFixed(1)},\${height - pad} Z\`
                  : ""
                const color = \`var(\${s.colorVar ?? \`--eui-chart-\${(sIdx % 6) + 1}\`}, var(--eui-primary))\`
                const dash = dashes[sIdx % dashes.length]
                return h.g.key(s.id).children(
                  h.path.attrs({ d: area, fill: \`url(#eui-area-\${s.id}-\${sIdx})\` }),
                  h.path.attrs({
                    d: line,
                    fill: "none",
                    stroke: color,
                    "stroke-width": "2",
                    ...(dash ? { "stroke-dasharray": dash } : {})
                  })
                )
              })
            )
    )
}
`
      }
    ]
  },
  {
    name: "chart-bar",
    title: "Bar Chart",
    category: "data",
    description: "Accessible responsive SVG grouped vertical bar chart with theme chart tokens.",
    registryDependencies: ["cn", "chart"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "charts/barChart.ts",
        content: `import type { Html } from "@effect/ui/html"
import { type ChartSeries, computeChartScale } from "../chart.js"
import { cn } from "../cn.js"

export const svgBarChart = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly title: string
    readonly series: ReadonlyArray<ChartSeries>
    readonly width?: number | undefined
    readonly height?: number | undefined
    readonly className?: string | undefined
  }
) => {
  const width = options.width ?? 480
  const height = options.height ?? 180
  const pad = 20
  const scale = computeChartScale(options.series)
  const range = Math.max(1e-6, scale.max - scale.min)
  const colCount = Math.max(1, options.series[0]?.points.length ?? 1)
  const groupW = (width - pad * 2) / colCount
  const barW = Math.max(4, (groupW - 8) / Math.max(1, options.series.length))

  const summary = options.series
    .map((s) => \`\${s.label}: \${s.points.map((p) => \`\${p.label} \${p.value}\`).join(", ")}\`)
    .join("; ")

  return h.figure
    .attrs({ role: "group", "aria-label": options.title, "data-chart-bar": "" })
    .class(cn("rounded-lg border border-border bg-surface p-4", options.className))
    .children(
      h.figcaption.class("mb-2 flex flex-wrap items-center justify-between gap-2").children(
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
      options.series.length === 0
        ? h.p.class("py-8 text-center text-xs text-muted-foreground").children("No data available")
        : h.div.class("flex flex-col gap-1.5").children(
            h.svg
              .attrs({ viewBox: \`0 0 \${width} \${height}\`, role: "img", "aria-label": \`\${options.title}: \${summary}\` })
              .class("h-44 w-full")
              .children(
                ...options.series.flatMap((s, sIdx) =>
                  s.points.map((p, colIdx) => {
                    const bh = Math.max(2, ((p.value - scale.min) / range) * (height - pad * 2))
                    const x = pad + colIdx * groupW + 4 + sIdx * barW
                    const y = height - pad - bh
                    const color = \`var(\${s.colorVar ?? \`--eui-chart-\${(sIdx % 6) + 1}\`}, var(--eui-primary))\`
                    return h.rect.key(\`\${s.id}-\${colIdx}\`).attrs({
                      x: x.toFixed(1),
                      y: y.toFixed(1),
                      width: Math.max(2, barW - 2).toFixed(1),
                      height: bh.toFixed(1),
                      rx: "3",
                      fill: color
                    })
                  })
                )
              ),
            h.div
              .attrs({ "aria-hidden": "true" })
              .class("grid gap-1 text-center text-xs tabular-nums text-muted-foreground")
              .style({ gridTemplateColumns: \`repeat(\${colCount}, minmax(0, 1fr))\` })
              .children(
                ...(options.series[0]?.points ?? []).map((p, colIdx) =>
                  h.span.key(\`lbl-\${colIdx}\`).attrs({ title: p.label }).class("truncate").children(p.label)
                )
              )
          )
    )
}
`
      }
    ]
  },
  {
    name: "chart-line",
    title: "Line Chart",
    category: "data",
    description: "Accessible responsive SVG multi-series line chart with data point markers.",
    registryDependencies: ["cn", "chart"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "charts/lineChart.ts",
        content: `import type { Html } from "@effect/ui/html"
import { type ChartSeries, computeChartScale } from "../chart.js"
import { cn } from "../cn.js"

export const lineChart = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly title: string
    readonly series: ReadonlyArray<ChartSeries>
    readonly width?: number | undefined
    readonly height?: number | undefined
    readonly className?: string | undefined
  }
) => {
  const width = options.width ?? 480
  const height = options.height ?? 180
  const pad = 20
  const scale = computeChartScale(options.series)
  const range = Math.max(1e-6, scale.max - scale.min)

  const dashes = ["", "6 3", "2 3", "8 3 2 3"] as const
  const summary = options.series
    .map((s) => \`\${s.label}: \${s.points.map((p) => \`\${p.label} \${p.value}\`).join(", ")}\`)
    .join("; ")

  return h.figure
    .attrs({ role: "group", "aria-label": options.title, "data-chart-line": "" })
    .class(cn("rounded-lg border border-border bg-surface p-4", options.className))
    .children(
      h.figcaption.class("mb-2 flex flex-wrap items-center justify-between gap-2").children(
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
      options.series.length === 0
        ? h.p.class("py-8 text-center text-xs text-muted-foreground").children("No data available")
        : h.svg
            .attrs({ viewBox: \`0 0 \${width} \${height}\`, role: "img", "aria-label": \`\${options.title}: \${summary}\` })
            .class("h-44 w-full")
            .children(
              ...options.series.map((s, sIdx) => {
                const count = Math.max(1, s.points.length - 1)
                const coords = s.points.map((p, idx) => ({
                  x: pad + (idx / count) * (width - pad * 2),
                  y: height - pad - ((p.value - scale.min) / range) * (height - pad * 2)
                }))
                const d = coords.map((c, i) => \`\${i === 0 ? "M" : "L"}\${c.x.toFixed(1)},\${c.y.toFixed(1)}\`).join(" ")
                const color = \`var(\${s.colorVar ?? \`--eui-chart-\${(sIdx % 6) + 1}\`}, var(--eui-primary))\`
                const dash = dashes[sIdx % dashes.length]
                return h.g.key(s.id).children(
                  h.path.attrs({
                    d,
                    fill: "none",
                    stroke: color,
                    "stroke-width": "2",
                    ...(dash ? { "stroke-dasharray": dash } : {})
                  }),
                  ...coords.map((c, i) =>
                    h.circle.key(String(i)).attrs({ cx: c.x.toFixed(1), cy: c.y.toFixed(1), r: "3", fill: color })
                  )
                )
              })
            )
    )
}
`
      }
    ]
  },
  {
    name: "chart-pie",
    title: "Pie and Donut Chart",
    category: "data",
    description: "Accessible responsive SVG pie and donut chart using stroke-dasharray segments.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "charts/pieChart.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "../cn.js"

export interface PieSlice {
  readonly id: string
  readonly label: string
  readonly value: number
  readonly colorVar?: string | undefined
}

export const pieChart = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly title: string
    readonly slices: ReadonlyArray<PieSlice>
    readonly donut?: boolean | undefined
    readonly className?: string | undefined
  }
) => {
  const total = Math.max(1e-6, options.slices.reduce((sum, s) => sum + Math.max(0, s.value), 0))
  const r = options.donut === true ? 36 : 25
  const strokeWidth = options.donut === true ? 18 : 50
  const circumference = 2 * Math.PI * r
  let offset = 0

  return h.figure
    .attrs({ role: "group", "aria-label": options.title, "data-chart-pie": "" })
    .class(cn("rounded-lg border border-border bg-surface p-4", options.className))
    .children(
      h.figcaption.class("mb-3 text-sm font-semibold text-foreground").children(options.title),
      h.div.class("flex flex-wrap items-center gap-6").children(
        h.svg
          .attrs({ viewBox: "0 0 120 120", role: "img", "aria-label": options.title })
          .class("h-32 w-32 -rotate-90")
          .children(
            ...options.slices.map((slice, idx) => {
              const frac = Math.max(0, slice.value) / total
              const dash = frac * circumference
              const currentOffset = offset
              offset += dash
              const color = \`var(\${slice.colorVar ?? \`--eui-chart-\${(idx % 6) + 1}\`}, var(--eui-primary))\`
              return h.circle.key(slice.id).attrs({
                cx: "60",
                cy: "60",
                r: String(r),
                fill: "none",
                stroke: color,
                "stroke-width": String(strokeWidth),
                "stroke-dasharray": \`\${dash.toFixed(2)} \${circumference.toFixed(2)}\`,
                "stroke-dashoffset": String(-currentOffset.toFixed(2))
              })
            })
          ),
        h.ul.class("flex flex-col gap-1.5 text-xs tabular-nums text-muted-foreground").children(
          ...options.slices.map((slice, idx) =>
            h.li.key(slice.id).class("flex items-center gap-2").children(
              h.span
                .attrs({ "aria-hidden": "true" })
                .class("inline-block h-2.5 w-2.5 rounded-xs")
                .style({
                  backgroundColor: \`var(\${slice.colorVar ?? \`--eui-chart-\${(idx % 6) + 1}\`}, var(--eui-primary))\`,
                  forcedColorAdjust: "none"
                }),
              \`\${slice.label}: \${Math.round((Math.max(0, slice.value) / total) * 100)}%\`
            )
          )
        )
      )
    )
}
`
      }
    ]
  },
  {
    name: "chart-radar",
    title: "Radar Chart",
    category: "data",
    description: "Accessible responsive SVG radar polygon chart comparing multi-axis metrics.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "charts/radarChart.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "../cn.js"

export interface RadarDatum {
  readonly axis: string
  readonly value: number
  readonly max?: number | undefined
}

export const radarChart = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly title: string
    readonly data: ReadonlyArray<RadarDatum>
    readonly colorVar?: string | undefined
    readonly className?: string | undefined
  }
) => {
  const cx = 100
  const cy = 100
  const radius = 64
  const n = Math.max(3, options.data.length)
  const color = \`var(\${options.colorVar ?? "--eui-chart-1"}, var(--eui-primary))\`
  const points = options.data
    .map((d, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2
      const ratio = Math.max(0, Math.min(1, d.value / Math.max(1e-6, d.max ?? 100)))
      return \`\${(cx + Math.cos(angle) * radius * ratio).toFixed(1)},\${(cy + Math.sin(angle) * radius * ratio).toFixed(1)}\`
    })
    .join(" ")
  const summary = options.data.map((d) => \`\${d.axis} \${d.value}\`).join(", ")

  return h.figure
    .attrs({ role: "group", "aria-label": options.title, "data-chart-radar": "" })
    .class(cn("rounded-lg border border-border bg-surface p-4", options.className))
    .children(
      h.figcaption.class("mb-2 text-sm font-semibold text-foreground").children(options.title),
      options.data.length === 0
        ? h.p.class("py-8 text-center text-xs text-muted-foreground").children("No data available")
        : h.div.class("flex flex-col items-center gap-3").children(
            h.svg
              .attrs({ viewBox: "0 0 200 200", role: "img", "aria-label": \`\${options.title}: \${summary}\` })
              .class("mx-auto h-44 w-44")
              .children(
                h.circle.attrs({ cx: String(cx), cy: String(cy), r: String(radius), fill: "none", stroke: "var(--eui-border)", "stroke-width": "1" }),
                h.circle.attrs({ cx: String(cx), cy: String(cy), r: String(radius / 2), fill: "none", stroke: "var(--eui-border)", "stroke-dasharray": "3 3" }),
                h.polygon.attrs({ points, fill: color, "fill-opacity": "0.25", stroke: color, "stroke-width": "2" })
              ),
            h.ul.class("flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground").children(
              ...options.data.map((d) =>
                h.li.key(d.axis).children(\`\${d.axis}: \${d.value}\`)
              )
            )
          )
    )
}
`
      }
    ]
  },
  {
    name: "chart-radial",
    title: "Radial Gauge Chart",
    category: "data",
    description: "Accessible responsive SVG radial progress gauge chart with centered KPI readout.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "charts/radialChart.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "../cn.js"

export const radialChart = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly title: string
    readonly value: number
    readonly max?: number | undefined
    readonly unit?: string | undefined
    readonly colorVar?: string | undefined
    readonly className?: string | undefined
  }
) => {
  const max = Math.max(1e-6, options.max ?? 100)
  const pct = Math.max(0, Math.min(1, options.value / max))
  const r = 44
  const c = 2 * Math.PI * r
  const color = \`var(\${options.colorVar ?? "--eui-chart-1"}, var(--eui-primary))\`

  return h.figure
    .attrs({ role: "group", "aria-label": options.title, "data-chart-radial": "" })
    .class(cn("inline-flex flex-col items-center rounded-lg border border-border bg-surface p-4", options.className))
    .children(
      h.figcaption.class("mb-2 text-sm font-semibold text-foreground").children(options.title),
      h.div.class("relative inline-flex items-center justify-center").children(
        h.svg
          .attrs({ viewBox: "0 0 120 120", "aria-hidden": "true" })
          .class("h-28 w-28")
          .children(
            h.circle.attrs({ cx: "60", cy: "60", r: String(r), fill: "none", stroke: "var(--eui-muted)", "stroke-width": "10" }),
            h.circle.attrs({
              cx: "60",
              cy: "60",
              r: String(r),
              fill: "none",
              stroke: color,
              "stroke-width": "10",
              "stroke-linecap": "round",
              "stroke-dasharray": \`\${(pct * c).toFixed(2)} \${c.toFixed(2)}\`,
              transform: "rotate(-90 60 60)"
            })
          ),
        h.span.class("absolute text-base font-semibold tabular-nums text-foreground").children(\`\${options.value}\${options.unit ?? "%"}\`)
      )
    )
}
`
      }
    ]
  },
  {
    name: "block-settings",
    title: "Settings Page Block",
    category: "blocks",
    description: "Complete workspace settings page block with profile inputs, notification switches, and save bar.",
    registryDependencies: ["cn", "button", "card", "input", "switch"],
    dependencies: ["effect", "@effect/ui"],
    files: [
      {
        path: "blocks/settings.ts",
        content: `import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { buttonClass } from "../button.js"
import { card, cardContent, cardDescription, cardHeader, cardTitle } from "../card.js"
import { styledInput } from "../input.js"
import { styledSwitch } from "../switch.js"

const SettingsMsg = UiSchema.TaggedEnum({
  NameChanged: { value: Schema.String },
  ToggleAlerts: {},
  Save: {}
})

export const SettingsBlock = Html.component({
  name: "SettingsBlock",
  props: Schema.Struct({}),
  model: Schema.Struct({
    workspaceName: Schema.String,
    emailAlerts: Schema.Boolean,
    saved: Schema.Boolean
  }),
  message: SettingsMsg
}).make({
  init: () => ({ workspaceName: "Kestrel Labs", emailAlerts: true, saved: false }),
  update: {
    NameChanged: ($, { value }) => $.evolve({ workspaceName: value, saved: false }),
    ToggleAlerts: ($) => $.evolve({ emailAlerts: !$.model.emailAlerts, saved: false }),
    Save: ($) => $.evolve({ saved: true })
  },
  view: (h, model) =>
    h.section.attrs({ "aria-label": "Workspace settings" }).class("mx-auto max-w-xl p-4 sm:p-6").children(
      card(h).children(
        cardHeader(h).children(
          cardTitle(h, "Workspace settings", { as: "h2" }),
          cardDescription(h, "Manage organization identity and alert preferences")
        ),
        cardContent(h).children(
          h.form
            .class("flex flex-col gap-4")
            .on("submit", () => SettingsMsg.Save(), { preventDefault: true })
            .children(
              h.div.class("flex flex-col gap-1.5").children(
                h.label.attrs({ for: "ws-name" }).class("text-sm font-medium").children("Workspace name"),
                styledInput(h, { id: "ws-name", autocomplete: "organization", enterkeyhint: "done" })
                  .value(model.workspaceName)
                  .on("input", ({ value }) => SettingsMsg.NameChanged({ value }))
              ),
              h.div.class("flex items-center justify-between gap-3").children(
                h.span.class("text-sm text-foreground").children("Email alerts"),
                styledSwitch(h, {
                  label: "Email alerts",
                  checked: model.emailAlerts,
                  onToggle: SettingsMsg.ToggleAlerts()
                })
              ),
              h.div.class("flex items-center justify-between pt-2").children(
                h.span.attrs({ role: "status" }).class("text-xs text-muted-foreground").children(model.saved ? "Saved" : ""),
                h.button.attrs({ type: "submit" }).class(buttonClass({ variant: "default" })).children("Save changes")
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
    name: "block-signup",
    title: "Sign-Up Page Block",
    category: "blocks",
    description: "Accessible account registration block with name, email, and Redacted PasswordInput.",
    registryDependencies: ["cn", "button", "card", "input"],
    dependencies: ["effect", "@effect/ui", "effect-ui-extra"],
    files: [
      {
        path: "blocks/signup.ts",
        content: `import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import { PasswordInput } from "effect-ui-extra/widgets"
import { buttonClass } from "../button.js"
import { card, cardContent, cardDescription, cardHeader, cardTitle } from "../card.js"
import { styledInput } from "../input.js"

const SignupMsg = UiSchema.TaggedEnum({
  EmailChanged: { value: Schema.String },
  PasswordChanged: { value: Schema.Redacted(Schema.String) },
  Submitted: {}
})

export const SignupBlock = Html.component({
  name: "SignupBlock",
  props: Schema.Struct({}),
  model: Schema.Struct({
    email: Schema.String,
    password: Schema.Redacted(Schema.String),
    created: Schema.Boolean,
    error: Schema.NullOr(Schema.String)
  }),
  message: SignupMsg
}).make({
  init: () => ({ email: "", password: Redacted.make(""), created: false, error: null }),
  update: {
    EmailChanged: ($, { value }) => $.evolve({ email: value, error: null, created: false }),
    PasswordChanged: ($, { value }) => $.evolve({ password: value, error: null, created: false }),
    Submitted: ($) => {
      if (!$.model.email.includes("@")) {
        return $.evolve({ error: "Enter an email address with an @ symbol", created: false })
      }
      if (Redacted.value($.model.password).length < 8) {
        return $.evolve({ error: "Use at least 8 characters for your password", created: false })
      }
      return $.evolve({ created: true, error: null })
    }
  },
  view: (h, model) =>
    h.section.attrs({ "aria-label": "Create account" }).class("mx-auto max-w-md p-4 sm:p-6").children(
      card(h).children(
        cardHeader(h).children(
          cardTitle(h, "Create account", { as: "h2" }),
          cardDescription(h, "Start building with Effect UI")
        ),
        cardContent(h).children(
          h.form
            .class("flex flex-col gap-3")
            .on("submit", () => SignupMsg.Submitted(), { preventDefault: true })
            .children(
              h.label.attrs({ for: "signup-email" }).class("text-sm font-medium").children("Email"),
              styledInput(h, {
                id: "signup-email",
                name: "email",
                type: "email",
                autocomplete: "username",
                spellcheck: "false",
                enterkeyhint: "next",
                required: true,
                placeholder: "you@example.com",
                invalid: model.error !== null && !model.email.includes("@"),
                describedBy: model.error !== null ? "signup-error" : undefined
              })
                .value(model.email)
                .on("input", ({ value }) => SignupMsg.EmailChanged({ value })),
              PasswordInput(h, {
                key: "signup-pw",
                props: {
                  id: "signup-pw",
                  label: "Password",
                  value: model.password,
                  autocomplete: "new-password"
                },
                onEmit: {
                  Changed: ({ value }) => SignupMsg.PasswordChanged({ value }),
                  ToggledVisibility: () => undefined
                }
              }),
              ...(model.error !== null
                ? [h.p.attrs({ id: "signup-error", role: "alert" }).class("text-xs text-destructive").children(model.error)]
                : []),
              h.button.attrs({ type: "submit" }).class(buttonClass({ variant: "default" })).children("Create account"),
              h.p.attrs({ role: "status" }).class("min-h-4 text-xs text-muted-foreground").children(model.created ? "Account created" : "")
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
    name: "block-otp",
    title: "OTP Verification Block",
    category: "blocks",
    description: "Two-factor verification page block combining Card, Input OTP (Redacted), and resend action.",
    registryDependencies: ["cn", "button", "card", "input-otp"],
    dependencies: ["effect", "@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "blocks/otp.ts",
        content: `import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import { buttonClass } from "../button.js"
import { card, cardContent, cardDescription, cardHeader, cardTitle } from "../card.js"
import { styledInputOtp } from "../inputOtp.js"

const OtpMsg = UiSchema.TaggedEnum({
  Updated: { value: Schema.Redacted(Schema.String) },
  Verified: {},
  Resent: {}
})

export const OtpBlock = Html.component({
  name: "OtpBlock",
  props: Schema.Struct({}),
  model: Schema.Struct({
    code: Schema.Redacted(Schema.String),
    verified: Schema.Boolean,
    resentCount: Schema.Number,
    error: Schema.NullOr(Schema.String)
  }),
  message: OtpMsg
}).make({
  init: () => ({ code: Redacted.make(""), verified: false, resentCount: 0, error: null }),
  update: {
    Updated: ($, { value }) => $.evolve({ code: value, verified: false, error: null }),
    Verified: ($) => {
      if (Redacted.value($.model.code).trim().length < 6) {
        return $.evolve({ error: "Enter all 6 digits to verify", verified: false })
      }
      return $.evolve({ verified: true, error: null })
    },
    Resent: ($) => $.evolve({ resentCount: $.model.resentCount + 1, error: null })
  },
  view: (h, model) =>
    h.section.attrs({ "aria-label": "Verify code" }).class("mx-auto max-w-md p-4 sm:p-6").children(
      card(h).children(
        cardHeader(h).children(
          cardTitle(h, "Verify your code", { as: "h2" }),
          cardDescription(h, "Enter the 6-digit code sent to your device")
        ),
        cardContent(h).children(
          h.form
            .class("flex flex-col items-center gap-4")
            .on("submit", () => OtpMsg.Verified(), { preventDefault: true })
            .children(
              styledInputOtp(h, {
                value: model.code,
                length: 6,
                onUpdate: (value) => OtpMsg.Updated({ value }),
                onComplete: () => OtpMsg.Verified()
              }),
              ...(model.error !== null
                ? [h.p.attrs({ role: "alert" }).class("text-xs text-destructive").children(model.error)]
                : []),
              h.div.class("flex flex-wrap items-center justify-center gap-2").children(
                h.button.attrs({ type: "submit" }).class(buttonClass({ variant: "default" })).children("Verify"),
                h.button.attrs({ type: "button" }).class(buttonClass({ variant: "outline" })).on("click", () => OtpMsg.Resent()).children("Resend code")
              ),
              h.p.attrs({ role: "status" }).class("min-h-4 text-xs text-muted-foreground").children(
                model.verified
                  ? "Code verified"
                  : model.resentCount > 0
                    ? "New verification code sent"
                    : ""
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
    name: "block-sidebar-inset",
    title: "Inset Sidebar Shell Block",
    category: "blocks",
    description: "Application shell with recessed inset main canvas and collapsible navigation rail.",
    registryDependencies: ["cn", "sidebar"],
    dependencies: ["effect", "@effect/ui"],
    files: [
      {
        path: "blocks/sidebarInset.ts",
        content: `import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { Sidebar } from "../sidebar.js"

const InsetMsg = UiSchema.TaggedEnum({
  Navigate: { id: Schema.String }
})

export const SidebarInsetBlock = Html.component({
  name: "SidebarInsetBlock",
  props: Schema.Struct({}),
  model: Schema.Struct({ activeId: Schema.String }),
  message: InsetMsg
}).make({
  init: () => ({ activeId: "overview" }),
  update: {
    Navigate: ($, { id }) => $.evolve({ activeId: id })
  },
  view: (h, model) =>
    h.div.class("flex min-h-dvh flex-col md:flex-row bg-muted p-2 gap-2").children(
      Sidebar(h, {
        key: "inset-sidebar",
        props: {
          title: "Workspace",
          activeId: model.activeId,
          groups: [
            {
              label: "Platform",
              items: [
                { id: "overview", label: "Overview", href: "#overview" },
                { id: "deployments", label: "Deployments", href: "#deployments" },
                { id: "billing", label: "Billing", href: "#billing" }
              ]
            }
          ]
        },
        onEmit: {
          Selected: ({ id }) => InsetMsg.Navigate({ id }),
          Toggled: () => undefined
        }
      }),
      h.main.class("flex-1 min-w-0 rounded-xl border border-border bg-background p-4 sm:p-6 shadow-sm dark:shadow-none").children(
        h.h2.class("text-lg font-semibold text-balance text-foreground").children(\`Section: \${model.activeId}\`),
        h.p.class("mt-2 text-sm text-muted-foreground text-pretty").children(
          "Select a workspace view from the navigation rail to inspect deployments, metrics, and billing"
        )
      )
    )
})
`
      }
    ]
  },
  {
    name: "block-sidebar-icons",
    title: "Icon-Rail Sidebar Block",
    category: "blocks",
    description: "Compact icon-first collapsible sidebar shell matching shadcn sidebar-07.",
    registryDependencies: ["cn", "sidebar"],
    dependencies: ["effect", "@effect/ui"],
    files: [
      {
        path: "blocks/sidebarIcons.ts",
        content: `import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { Sidebar } from "../sidebar.js"

const IconRailMsg = UiSchema.TaggedEnum({
  Select: { id: Schema.String }
})

export const SidebarIconsBlock = Html.component({
  name: "SidebarIconsBlock",
  props: Schema.Struct({}),
  model: Schema.Struct({ activeId: Schema.String }),
  message: IconRailMsg
}).make({
  init: () => ({ activeId: "inbox" }),
  update: {
    Select: ($, { id }) => $.evolve({ activeId: id })
  },
  view: (h, model) =>
    h.div.class("flex min-h-dvh flex-col md:flex-row bg-background").children(
      Sidebar(h, {
        key: "icon-sidebar",
        props: {
          title: "Mail",
          defaultCollapsed: true,
          activeId: model.activeId,
          groups: [
            {
              label: "Folders",
              items: [
                { id: "inbox", label: "Inbox", href: "#inbox", badge: "4" },
                { id: "sent", label: "Sent", href: "#sent" },
                { id: "archive", label: "Archive", href: "#archive" }
              ]
            }
          ]
        },
        onEmit: {
          Selected: ({ id }) => IconRailMsg.Select({ id }),
          Toggled: () => undefined
        }
      }),
      h.main.class("flex-1 min-w-0 p-4 sm:p-6 text-sm text-foreground").children(
        h.h2.class("text-base font-semibold text-foreground").children(\`Active folder: \${model.activeId}\`)
      )
    )
})
`
      }
    ]
  },
  {
    name: "block-calendar-presets",
    title: "Calendar With Presets Block",
    category: "blocks",
    description: "Date picker card combining Calendar with quick relative-day preset buttons.",
    registryDependencies: ["cn", "button", "card", "calendar"],
    dependencies: ["effect", "@effect/ui", "@effect/ui-kit"],
    files: [
      {
        path: "blocks/calendarPresets.ts",
        content: `import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as DateTime from "effect/DateTime"
import * as Schema from "effect/Schema"
import { buttonClass } from "../button.js"
import { styledCalendar } from "../calendar.js"
import { card, cardContent, cardHeader, cardTitle } from "../card.js"

const DEFAULT_TODAY_ISO = "2026-11-28T00:00:00.000Z"

const CalPresetMsg = UiSchema.TaggedEnum({
  PickDaysOffset: { days: Schema.Number },
  PickDate: { iso: Schema.String },
  ChangeMonth: { iso: Schema.String }
})

export const CalendarPresetsBlock = Html.component({
  name: "CalendarPresetsBlock",
  props: Schema.Struct({
    todayIso: Schema.optional(Schema.String),
    firstDayOfWeek: Schema.optional(Schema.Literals([0, 1, 2, 3, 4, 5, 6]))
  }),
  model: Schema.Struct({
    monthIso: Schema.String,
    selectedIso: Schema.String
  }),
  message: CalPresetMsg
}).make({
  init: ($) => {
    const base = $.props.todayIso ?? DEFAULT_TODAY_ISO
    return { monthIso: base, selectedIso: base }
  },
  update: {
    PickDaysOffset: ($, { days }) => {
      const base = DateTime.makeUnsafe($.props.todayIso ?? DEFAULT_TODAY_ISO)
      const target = DateTime.add(base, { days })
      const iso = DateTime.formatIso(target)
      return $.evolve({ monthIso: iso, selectedIso: iso })
    },
    PickDate: ($, { iso }) => $.evolve({ selectedIso: iso }),
    ChangeMonth: ($, { iso }) => $.evolve({ monthIso: iso })
  },
  view: (h, model) => {
    const today = DateTime.makeUnsafe(h.props.todayIso ?? DEFAULT_TODAY_ISO)
    const month = DateTime.makeUnsafe(model.monthIso)
    const selected = DateTime.makeUnsafe(model.selectedIso)
    return card(h, "w-full max-w-md").children(
      cardHeader(h).children(cardTitle(h, "Schedule date", { as: "h2" })),
      cardContent(h, "flex flex-col gap-3").children(
        h.div.class("flex flex-wrap gap-2").children(
          h.button.attrs({ type: "button" }).class(buttonClass({ variant: "outline", size: "sm" })).on("click", () => CalPresetMsg.PickDaysOffset({ days: 0 })).children("Today"),
          h.button.attrs({ type: "button" }).class(buttonClass({ variant: "outline", size: "sm" })).on("click", () => CalPresetMsg.PickDaysOffset({ days: 1 })).children("Tomorrow"),
          h.button.attrs({ type: "button" }).class(buttonClass({ variant: "outline", size: "sm" })).on("click", () => CalPresetMsg.PickDaysOffset({ days: 7 })).children("In 1 week")
        ),
        h.div.class("overflow-x-auto").children(
          styledCalendar(h, {
            month,
            today,
            value: selected,
            firstDayOfWeek: h.props.firstDayOfWeek ?? 1,
            className: "border-0 bg-transparent p-0",
            onPick: (date) => CalPresetMsg.PickDate({ iso: DateTime.formatIso(date) }),
            onMonthChange: (m) => CalPresetMsg.ChangeMonth({ iso: DateTime.formatIso(m) })
          })
        )
      )
    )
  }
})
`
      }
    ]
  }
]
