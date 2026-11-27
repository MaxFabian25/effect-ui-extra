import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"

export const PaneSpec = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  minSize: Schema.optional(Schema.Number),
  maxSize: Schema.optional(Schema.Number),
  collapsible: Schema.optional(Schema.Boolean),
  collapsedSize: Schema.optional(Schema.Number)
})
export type PaneSpec = typeof PaneSpec.Type

export const ResizableProps = Schema.Struct({
  panes: Schema.Array(PaneSpec),
  sizes: Schema.Array(Schema.Number),
  orientation: Schema.optional(Schema.Literals(["horizontal", "vertical"])),
  step: Schema.optional(Schema.Number),
  largeStep: Schema.optional(Schema.Number),
  idPrefix: Schema.optional(Schema.String)
})
export type ResizableProps = typeof ResizableProps.Type

export const ResizableEvents = UiSchema.TaggedEnum({
  Resized: { sizes: Schema.Array(Schema.Number) }
})
export type ResizableEvents = typeof ResizableEvents.Type

const ResizableMsg = UiSchema.TaggedEnum({
  Adjusted: { handleIndex: Schema.Number, delta: Schema.Number },
  SetEdge: { handleIndex: Schema.Number, edge: Schema.Literals(["min", "max"]) },
  ToggledCollapse: { handleIndex: Schema.Number }
})

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Pure layout solver for `Resizable` split panes. Adjusts the pair of panes
 * adjacent to `handleIndex` by `deltaPercent` while enforcing `minSize`,
 * `maxSize`, and exact sum preservation.
 */
export const resizePanes = (
  sizes: ReadonlyArray<number>,
  panes: ReadonlyArray<PaneSpec>,
  handleIndex: number,
  deltaPercent: number
): ReadonlyArray<number> => {
  if (handleIndex < 0 || handleIndex >= sizes.length - 1) return sizes
  const leftSpec = panes[handleIndex]
  const rightSpec = panes[handleIndex + 1]
  if (leftSpec === undefined || rightSpec === undefined) return sizes

  const leftCurr = sizes[handleIndex]!
  const rightCurr = sizes[handleIndex + 1]!
  const pairTotal = leftCurr + rightCurr

  const leftMin = leftSpec.minSize ?? 5
  const leftMax = leftSpec.maxSize ?? 95
  const rightMin = rightSpec.minSize ?? 5
  const rightMax = rightSpec.maxSize ?? 95

  const minAllowedLeft = Math.max(leftMin, pairTotal - rightMax)
  const maxAllowedLeft = Math.min(leftMax, pairTotal - rightMin)

  const targetLeft = Math.max(
    minAllowedLeft,
    Math.min(maxAllowedLeft, leftCurr + deltaPercent)
  )
  const nextLeft = round2(targetLeft)
  const nextRight = round2(pairTotal - nextLeft)

  const out = [...sizes]
  out[handleIndex] = nextLeft
  out[handleIndex + 1] = nextRight
  return out
}

/**
 * Accessible WAI-ARIA Window Splitter (`Resizable` split panes).
 *
 * Each handle renders `role="separator"`, `tabindex="0"`, `aria-orientation`
 * perpendicular to the split axis, `aria-valuenow`/`min`/`max`, and
 * `aria-controls` pointing to its primary pane. Supports Arrow keys (`step`),
 * Shift+Arrow (`largeStep`), `Home` (min), `End` (max), and `Enter`
 * (collapse/restore when `collapsible: true`).
 */
export const Resizable = Html.component({
  name: "Resizable",
  props: ResizableProps,
  model: Schema.Struct({
    /** Stores pre-collapse size per pane id so Enter restores cleanly. */
    restoredSizes: Schema.Record(Schema.String, Schema.Number)
  }),
  message: ResizableMsg,
  events: ResizableEvents
}).make({
  init: () => ({ restoredSizes: {} }),
  update: {
    Adjusted: ($, { delta, handleIndex }) => {
      const next = resizePanes($.props.sizes, $.props.panes, handleIndex, delta)
      return $.emit(ResizableEvents.Resized({ sizes: [...next] }))
    },
    SetEdge: ($, { edge, handleIndex }) => {
      const leftSpec = $.props.panes[handleIndex]
      const rightSpec = $.props.panes[handleIndex + 1]
      if (leftSpec === undefined || rightSpec === undefined) return $.model
      const leftCurr = $.props.sizes[handleIndex] ?? 50
      const target =
        edge === "min" ? (leftSpec.minSize ?? 5) : (leftSpec.maxSize ?? 95)
      const next = resizePanes(
        $.props.sizes,
        $.props.panes,
        handleIndex,
        target - leftCurr
      )
      return $.emit(ResizableEvents.Resized({ sizes: [...next] }))
    },
    ToggledCollapse: ($, { handleIndex }) => {
      const leftSpec = $.props.panes[handleIndex]
      const rightSpec = $.props.panes[handleIndex + 1]
      if (leftSpec === undefined || rightSpec === undefined || !leftSpec.collapsible) {
        return $.model
      }
      const collapsedSize = leftSpec.collapsedSize ?? 0
      const curr = $.props.sizes[handleIndex] ?? 50
      const pairTotal = curr + ($.props.sizes[handleIndex + 1] ?? 50)
      const isCollapsed = curr <= collapsedSize + 0.01

      if (isCollapsed) {
        const restoreTo =
          $.model.restoredSizes[leftSpec.id] ?? Math.max(leftSpec.minSize ?? 15, 25)
        const nextLeft = round2(
          Math.min(leftSpec.maxSize ?? 95, Math.max(leftSpec.minSize ?? 5, restoreTo))
        )
        const out = [...$.props.sizes]
        out[handleIndex] = nextLeft
        out[handleIndex + 1] = round2(pairTotal - nextLeft)
        return $.emit(ResizableEvents.Resized({ sizes: out }))
      }

      const out = [...$.props.sizes]
      out[handleIndex] = collapsedSize
      out[handleIndex + 1] = round2(pairTotal - collapsedSize)
      return $.evolve({
        restoredSizes: { ...$.model.restoredSizes, [leftSpec.id]: curr }
      }).emit(ResizableEvents.Resized({ sizes: out }))
    }
  },
  view: (h) => {
    const p = h.props
    const orientation = p.orientation ?? "horizontal"
    const separatorOrientation =
      orientation === "horizontal" ? "vertical" : "horizontal"
    const step = p.step ?? 5
    const largeStep = p.largeStep ?? 15
    const prefix = p.idPrefix ?? "resizable"

    const children = []
    for (let i = 0; i < p.panes.length; i++) {
      const pane = p.panes[i]!
      const size = p.sizes[i] ?? 50
      const paneId = `${prefix}-pane-${pane.id}`
      children.push(
        h.div
          .key(`pane-${pane.id}`)
          .attrs({
            id: paneId,
            "data-pane": pane.id,
            "data-size": String(size),
            style: `flex:${size} 1 0%`
          })
          .children(pane.label)
      )

      if (i < p.panes.length - 1) {
        const min = pane.collapsible
          ? (pane.collapsedSize ?? 0)
          : (pane.minSize ?? 5)
        const max = pane.maxSize ?? 95
        const incKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown"
        const decKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp"

        children.push(
          h.div
            .key(`handle-${i}`)
            .attrs({
              role: "separator",
              tabindex: "0",
              "aria-label": `Resize ${pane.label}`,
              "aria-orientation": separatorOrientation,
              "aria-valuenow": String(round2(size)),
              "aria-valuemin": String(min),
              "aria-valuemax": String(max),
              "aria-controls": paneId,
              "data-resize-handle": String(i)
            })
            .on(
              "keydown",
              ({ key, shift }) => {
                const delta = shift ? largeStep : step
                if (key === incKey) {
                  return ResizableMsg.Adjusted({ handleIndex: i, delta })
                }
                if (key === decKey) {
                  return ResizableMsg.Adjusted({ handleIndex: i, delta: -delta })
                }
                if (key === "Home") {
                  return ResizableMsg.SetEdge({ handleIndex: i, edge: "min" })
                }
                if (key === "End") {
                  return ResizableMsg.SetEdge({ handleIndex: i, edge: "max" })
                }
                if (key === "Enter" && pane.collapsible) {
                  return ResizableMsg.ToggledCollapse({ handleIndex: i })
                }
                return undefined
              },
              { preventDefault: true }
            )
        )
      }
    }

    return h.div
      .attrs({
        "data-resizable": "",
        "data-orientation": orientation,
        style: `display:flex;flex-direction:${orientation === "horizontal" ? "row" : "column"}`
      })
      .children(...children)
  }
})
