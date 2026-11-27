import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"

export type PaginationToken = number | "ellipsis"

export interface PaginationRangeInput {
  readonly page: number
  readonly totalPages: number
  readonly siblingCount?: number | undefined
  readonly boundaryCount?: number | undefined
}

const range = (start: number, end: number): Array<number> => {
  const out: Array<number> = []
  for (let i = start; i <= end; i++) out.push(i)
  return out
}

/**
 * Computes a compact pagination sequence with smart ellipsis gaps
 * (for example `[1, "ellipsis", 4, 5, 6, 7, 8, "ellipsis", 20]`).
 */
export const buildPaginationRange = (
  input: PaginationRangeInput
): ReadonlyArray<PaginationToken> => {
  const total = Math.max(1, Math.floor(input.totalPages))
  const page = Math.min(total, Math.max(1, Math.floor(input.page)))
  const siblingCount = Math.max(0, Math.floor(input.siblingCount ?? 1))
  const boundaryCount = Math.max(1, Math.floor(input.boundaryCount ?? 1))

  const startPages = range(1, Math.min(boundaryCount, total))
  const endPages = range(
    Math.max(total - boundaryCount + 1, boundaryCount + 1),
    total
  )

  const siblingsStart = Math.max(
    Math.min(
      page - siblingCount,
      total - boundaryCount - siblingCount * 2 - 1
    ),
    boundaryCount + 2
  )
  const siblingsEnd = Math.min(
    Math.max(page + siblingCount, boundaryCount + siblingCount * 2 + 2),
    endPages.length > 0 ? endPages[0]! - 2 : total - 1
  )

  const tokens: Array<PaginationToken> = [...startPages]

  if (siblingsStart > boundaryCount + 2) {
    tokens.push("ellipsis")
  } else if (boundaryCount + 1 < total - boundaryCount) {
    tokens.push(boundaryCount + 1)
  }

  tokens.push(...range(siblingsStart, siblingsEnd))

  if (siblingsEnd < total - boundaryCount - 1) {
    tokens.push("ellipsis")
  } else if (total - boundaryCount > boundaryCount) {
    tokens.push(total - boundaryCount)
  }

  tokens.push(...endPages)
  return tokens
}

export const PaginationProps = Schema.Struct({
  label: Schema.optional(Schema.String),
  page: Schema.Number,
  totalPages: Schema.Number,
  siblingCount: Schema.optional(Schema.Number),
  boundaryCount: Schema.optional(Schema.Number)
})
export type PaginationProps = typeof PaginationProps.Type

export const PaginationEvents = UiSchema.TaggedEnum({
  PageChanged: { page: Schema.Number }
})
export type PaginationEvents = typeof PaginationEvents.Type

const PaginationMsg = UiSchema.TaggedEnum({
  GoTo: { page: Schema.Number }
})

/**
 * Accessible `<nav aria-label="Pagination">` component with smart ellipsis
 * truncation, `aria-current="page"`, and Previous/Next navigation controls.
 */
export const Pagination = Html.component({
  name: "Pagination",
  props: PaginationProps,
  model: Schema.Struct({}),
  message: PaginationMsg,
  events: PaginationEvents
}).make({
  init: () => ({}),
  update: {
    GoTo: ($, { page }) => {
      const total = Math.max(1, Math.floor($.props.totalPages))
      const clamped = Math.min(total, Math.max(1, Math.floor(page)))
      if (clamped === $.props.page) return $.model
      return $.emit(PaginationEvents.PageChanged({ page: clamped }))
    }
  },
  view: (h) => {
    const p = h.props
    const total = Math.max(1, Math.floor(p.totalPages))
    const current = Math.min(total, Math.max(1, Math.floor(p.page)))
    const tokens = buildPaginationRange({
      page: current,
      totalPages: total,
      siblingCount: p.siblingCount,
      boundaryCount: p.boundaryCount
    })

    return h.nav
      .attrs({ "aria-label": p.label ?? "Pagination", "data-pagination": "" })
      .children(
        h.button
          .attrs({
            type: "button",
            "aria-label": "Previous page"
          })
          .disabled(current <= 1)
          .on("click", () => PaginationMsg.GoTo({ page: current - 1 }))
          .children("Previous"),
        ...tokens.map((token, idx) =>
          token === "ellipsis"
            ? h.span
                .key(`ellipsis-${idx}`)
                .attrs({ "aria-hidden": "true", "data-ellipsis": "" })
                .children("...")
            : h.button
                .key(`page-${token}`)
                .attrs({
                  type: "button",
                  "aria-label": `Page ${token}`,
                  ...(token === current ? { "aria-current": "page" } : {})
                })
                .on("click", () => PaginationMsg.GoTo({ page: token }))
                .children(String(token))
        ),
        h.button
          .attrs({
            type: "button",
            "aria-label": "Next page"
          })
          .disabled(current >= total)
          .on("click", () => PaginationMsg.GoTo({ page: current + 1 }))
          .children("Next")
      )
  }
})
