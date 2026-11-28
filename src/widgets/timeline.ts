import { UiSchema } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { resolveDir } from "./internal.js"

export const TimelineStatusSchema = Schema.Literals([
  "completed",
  "current",
  "upcoming",
  "error"
])
export type TimelineStatus = typeof TimelineStatusSchema.Type

export const TimelineItemSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  timestamp: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  status: Schema.optional(TimelineStatusSchema)
})
export type TimelineItem = typeof TimelineItemSchema.Type

export const TimelineProps = Schema.Struct({
  label: Schema.String,
  items: Schema.Array(TimelineItemSchema),
  orientation: Schema.optional(Schema.Literals(["vertical", "horizontal"])),
  dir: Schema.optional(Schema.Literals(["ltr", "rtl"])),
  activeId: Schema.optional(Schema.String),
  selectable: Schema.optional(Schema.Boolean)
})
export type TimelineProps = typeof TimelineProps.Type

export const TimelineEvents = UiSchema.TaggedEnum({
  ItemSelected: { id: Schema.String }
})
export type TimelineEvents = typeof TimelineEvents.Type

const TimelineMsg = UiSchema.TaggedEnum({
  Select: { id: Schema.String },
  FocusDone: {}
})

const itemRef = (id: string) => Html.ref(`TimelineItem[${id}]`, "button")

/**
 * Accessible ordered Timeline widget supporting vertical or horizontal
 * orientation, RTL horizontal arrow reversal, semantic step statuses
 * (`completed`, `current`, `upcoming`, `error`), `aria-current="step"`, and
 * optional keyboard-navigable selection.
 */
export const Timeline = Html.component({
  name: "Timeline",
  props: TimelineProps,
  model: Schema.Struct({ activeId: Schema.NullOr(Schema.String) }),
  message: TimelineMsg,
  events: TimelineEvents
}).make({
  init: ($) => ({ activeId: $.props.activeId ?? null }),
  update: {
    Select: ($, { id }) =>
      $.evolve({ activeId: id })
        .emit(TimelineEvents.ItemSelected({ id }))
        .run(HtmlCommand.focus(itemRef(id), () => TimelineMsg.FocusDone())),
    FocusDone: ($) => $.model
  },
  view: (h, model) => {
    const p = h.props
    const orientation = p.orientation ?? "vertical"
    const activeId = p.activeId ?? model.activeId
    const selectable = p.selectable ?? false
    const focusStopId =
      activeId !== null && p.items.some((item) => item.id === activeId)
        ? activeId
        : (p.items[0]?.id ?? null)

    return h.ol
      .attrs({
        role: "list",
        "aria-label": p.label,
        ...(p.dir !== undefined ? { dir: p.dir } : {}),
        "data-timeline": "",
        "data-orientation": orientation
      })
      .children(
        ...p.items.map((item, idx) => {
          const status = item.status ?? (item.id === activeId ? "current" : "upcoming")
          const isCurrent = item.id === activeId || status === "current"

          const contentNodes = [
            h.span.attrs({ "data-timeline-marker": "", "aria-hidden": "true" }),
            h.div
              .attrs({ "data-timeline-body": "" })
              .children(
                h.span.attrs({ "data-timeline-title": "" }).children(item.title),
                ...(item.timestamp !== undefined
                  ? [h.time.attrs({ "data-timeline-time": "" }).children(item.timestamp)]
                  : []),
                ...(item.description !== undefined
                  ? [h.p.attrs({ "data-timeline-description": "" }).children(item.description)]
                  : [])
              )
          ]

          return h.li
            .key(item.id)
            .attrs({
              "data-timeline-item": "",
              "data-status": status,
              ...(!selectable && isCurrent ? { "aria-current": "step" } : {})
            })
            .children(
              selectable
                ? h.button
                    .ref(itemRef(item.id))
                    .attrs({
                      type: "button",
                      tabindex: item.id === focusStopId ? "0" : "-1",
                      "aria-label": item.timestamp !== undefined
                        ? `${item.title} (${item.timestamp})`
                        : item.title,
                      ...(isCurrent ? { "aria-current": "step" } : {}),
                      "data-timeline-trigger": ""
                    })
                    .on("click", () => TimelineMsg.Select({ id: item.id }))
                    .on(
                      "keydown",
                      ({ key }) => {
                        const isRtl = resolveDir(p.dir) === "rtl"
                        const prevKey =
                          orientation === "horizontal"
                            ? isRtl
                              ? "ArrowRight"
                              : "ArrowLeft"
                            : "ArrowUp"
                        const nextKey =
                          orientation === "horizontal"
                            ? isRtl
                              ? "ArrowLeft"
                              : "ArrowRight"
                            : "ArrowDown"
                        if (key === nextKey && idx + 1 < p.items.length) {
                          return TimelineMsg.Select({ id: p.items[idx + 1]!.id })
                        }
                        if (key === prevKey && idx > 0) {
                          return TimelineMsg.Select({ id: p.items[idx - 1]!.id })
                        }
                        if (key === "Home" && p.items.length > 0) {
                          return TimelineMsg.Select({ id: p.items[0]!.id })
                        }
                        if (key === "End" && p.items.length > 0) {
                          return TimelineMsg.Select({ id: p.items[p.items.length - 1]!.id })
                        }
                        return undefined
                      },
                      { preventDefault: true }
                    )
                    .children(...contentNodes)
                : h.div.attrs({ "data-timeline-row": "" }).children(...contentNodes)
            )
        })
      )
  }
})
