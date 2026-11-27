import { UiSchema } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import * as Schema from "effect/Schema"

export const WaterfallSpanSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  startMs: Schema.Number,
  durationMs: Schema.Number,
  depth: Schema.optional(Schema.Number),
  status: Schema.optional(Schema.Literals(["ok", "error", "pending"])),
  category: Schema.optional(Schema.String)
})
export type WaterfallSpan = typeof WaterfallSpanSchema.Type

export interface WaterfallBarLayout {
  readonly span: WaterfallSpan
  readonly leftPct: number
  readonly widthPct: number
  readonly endMs: number
  readonly depth: number
}

export interface WaterfallLayout {
  readonly minMs: number
  readonly maxMs: number
  readonly totalDurationMs: number
  readonly bars: ReadonlyArray<WaterfallBarLayout>
  readonly ticks: ReadonlyArray<{ readonly ms: number; readonly pct: number; readonly label: string }>
}

export const formatDurationMs = (ms: number): string => {
  if (!Number.isFinite(ms)) return "0ms"
  const abs = Math.abs(ms)
  if (abs < 1) return `${Math.round(ms * 100) / 100}ms`
  if (abs < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Pure waterfall timeline layout computation for network traces, agent tool
 * call waterfalls, and Gantt schedules.
 */
export const computeWaterfallLayout = (
  spans: ReadonlyArray<WaterfallSpan>,
  options?: {
    readonly rangeStartMs?: number | undefined
    readonly rangeEndMs?: number | undefined
    readonly tickCount?: number | undefined
  }
): WaterfallLayout => {
  if (spans.length === 0) {
    return { minMs: 0, maxMs: 0, totalDurationMs: 0, bars: [], ticks: [] }
  }
  const derivedMin = Math.min(...spans.map((s) => s.startMs))
  const derivedMax = Math.max(...spans.map((s) => s.startMs + Math.max(0, s.durationMs)))
  const minMs = options?.rangeStartMs ?? derivedMin
  const maxMs = Math.max(minMs, options?.rangeEndMs ?? derivedMax)
  const totalDurationMs = Math.max(0, maxMs - minMs)
  const denom = totalDurationMs === 0 ? 1 : totalDurationMs

  const bars: Array<WaterfallBarLayout> = spans.map((span) => {
    const dur = Math.max(0, span.durationMs)
    const clampedStart = Math.max(minMs, Math.min(maxMs, span.startMs))
    const clampedEnd = Math.max(clampedStart, Math.min(maxMs, span.startMs + dur))
    const leftPct = ((clampedStart - minMs) / denom) * 100
    const widthPct = ((clampedEnd - clampedStart) / denom) * 100
    return {
      span,
      leftPct: Math.round(leftPct * 1000) / 1000,
      widthPct: Math.round(widthPct * 1000) / 1000,
      endMs: span.startMs + dur,
      depth: Math.max(0, Math.floor(span.depth ?? 0))
    }
  })

  const tickCount = Math.max(2, Math.floor(options?.tickCount ?? 5))
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const ratio = i / (tickCount - 1)
    const ms = minMs + totalDurationMs * ratio
    return {
      ms,
      pct: Math.round(ratio * 1000) / 10,
      label: formatDurationMs(ms - minMs)
    }
  })

  return { minMs, maxMs, totalDurationMs, bars, ticks }
}

export const WaterfallProps = Schema.Struct({
  label: Schema.String,
  spans: Schema.Array(WaterfallSpanSchema),
  selectedId: Schema.optional(Schema.String),
  tickCount: Schema.optional(Schema.Number)
})
export type WaterfallProps = typeof WaterfallProps.Type

export const WaterfallEvents = UiSchema.TaggedEnum({
  SpanSelected: { id: Schema.String }
})
export type WaterfallEvents = typeof WaterfallEvents.Type

const WaterfallMsg = UiSchema.TaggedEnum({
  Select: { id: Schema.String },
  FocusDone: {}
})

const rowRef = (id: string) => Html.ref(`WaterfallRow[${id}]`, "button")

/**
 * Accessible Waterfall timeline widget for agent tool traces, request spans,
 * and Gantt schedules with keyed cells, keyboard row navigation, and duration
 * readouts.
 */
export const Waterfall = Html.component({
  name: "Waterfall",
  props: WaterfallProps,
  model: Schema.Struct({ selectedId: Schema.NullOr(Schema.String) }),
  message: WaterfallMsg,
  events: WaterfallEvents
}).make({
  init: ($) => ({ selectedId: $.props.selectedId ?? null }),
  update: {
    Select: ($, { id }) =>
      $.evolve({ selectedId: id })
        .emit(WaterfallEvents.SpanSelected({ id }))
        .run(HtmlCommand.focus(rowRef(id), () => WaterfallMsg.FocusDone())),
    FocusDone: ($) => $.model
  },
  view: (h, model) => {
    const p = h.props
    const layout = computeWaterfallLayout(p.spans, { tickCount: p.tickCount })
    const selectedId = p.selectedId ?? model.selectedId
    const focusStopId =
      selectedId !== null && p.spans.some((s) => s.id === selectedId)
        ? selectedId
        : (p.spans[0]?.id ?? null)

    return h.div
      .attrs({
        role: "grid",
        "aria-label": p.label,
        "aria-rowcount": String(layout.bars.length),
        "data-waterfall": ""
      })
      .children(
        h.div
          .attrs({ role: "row", "data-waterfall-axis": "" })
          .children(
            ...layout.ticks.map((tick, idx) =>
              h.span
                .key(`tick-${idx}`)
                .attrs({ role: "columnheader", "data-waterfall-tick": "" })
                .style({ left: `${tick.pct}%` })
                .children(tick.label)
            )
          ),
        ...layout.bars.map((bar, idx) => {
          const isSelected = bar.span.id === selectedId
          const durLabel = formatDurationMs(bar.span.durationMs)
          return h.div
            .key(bar.span.id)
            .attrs({
              role: "row",
              "aria-rowindex": String(idx + 1),
              "aria-selected": String(isSelected),
              "data-waterfall-row": "",
              "data-status": bar.span.status ?? "ok",
              ...(bar.span.category !== undefined ? { "data-category": bar.span.category } : {})
            })
            .children(
              h.div
                .key(`${bar.span.id}-label`)
                .attrs({ role: "gridcell", "data-waterfall-label": "" })
                .style({ paddingLeft: `${bar.depth * 14}px` })
                .children(
                  h.button
                    .ref(rowRef(bar.span.id))
                    .attrs({
                      type: "button",
                      tabindex: bar.span.id === focusStopId ? "0" : "-1",
                      "aria-label": `${bar.span.label}, ${durLabel}`
                    })
                    .on("click", () => WaterfallMsg.Select({ id: bar.span.id }))
                    .on(
                      "keydown",
                      ({ key }) => {
                        if (key === "ArrowDown" && idx + 1 < layout.bars.length) {
                          return WaterfallMsg.Select({ id: layout.bars[idx + 1]!.span.id })
                        }
                        if (key === "ArrowUp" && idx > 0) {
                          return WaterfallMsg.Select({ id: layout.bars[idx - 1]!.span.id })
                        }
                        if (key === "Home" && layout.bars.length > 0) {
                          return WaterfallMsg.Select({ id: layout.bars[0]!.span.id })
                        }
                        if (key === "End" && layout.bars.length > 0) {
                          return WaterfallMsg.Select({
                            id: layout.bars[layout.bars.length - 1]!.span.id
                          })
                        }
                        return undefined
                      },
                      { preventDefault: true }
                    )
                    .children(bar.span.label)
                ),
              h.div
                .key(`${bar.span.id}-track`)
                .attrs({ role: "gridcell", "data-waterfall-track": "" })
                .children(
                  h.span
                    .attrs({
                      "data-waterfall-bar": "",
                      "data-left-pct": String(bar.leftPct),
                      "data-width-pct": String(bar.widthPct)
                    })
                    .style({
                      left: `${bar.leftPct}%`,
                      width: `${Math.max(bar.widthPct, 0.5)}%`
                    })
                    .children(durLabel)
                )
            )
        })
      )
  }
})
