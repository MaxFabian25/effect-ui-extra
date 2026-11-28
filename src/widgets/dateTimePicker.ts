import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { firstDayOfWeek, parsePlainDate } from "../direct/dateLocale.js"
import { TimeInput } from "./timeInput.js"

export interface ParsedDateTime {
  readonly date: string
  readonly time: string
}

/** Splits an ISO local datetime string (`YYYY-MM-DDTHH:mm[:ss]`) into validated date and time parts. */
export const parseDateTimeString = (raw: string): ParsedDateTime | undefined => {
  const [datePart, timePart] = raw.trim().split("T")
  if (datePart === undefined || timePart === undefined) return undefined
  if (parsePlainDate(datePart) === undefined) return undefined
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(timePart)) return undefined
  return { date: datePart, time: timePart }
}

export const formatDateTimeString = (date: string, time: string): string =>
  `${date}T${time}`

export const DateTimePickerProps = Schema.Struct({
  label: Schema.String,
  value: Schema.String,
  locale: Schema.optional(Schema.String),
  hourCycle: Schema.optional(Schema.Literals([12, 24])),
  granularity: Schema.optional(Schema.Literals(["minute", "second"])),
  disabled: Schema.optional(Schema.Boolean),
  idPrefix: Schema.optional(Schema.String)
})
export type DateTimePickerProps = typeof DateTimePickerProps.Type

export const DateTimePickerEvents = UiSchema.TaggedEnum({
  ValueChanged: { value: Schema.String }
})
export type DateTimePickerEvents = typeof DateTimePickerEvents.Type

const DateTimePickerMsg = UiSchema.TaggedEnum({
  DateChanged: { date: Schema.String },
  TimeChanged: { time: Schema.String }
})

/**
 * Combined Date + Time moment picker bridging `Effect-TS/ui#567` by pairing
 * native date input (with CLDR week-start metadata) and `TimeInput` spinbuttons.
 */
export const DateTimePicker = Html.component({
  name: "DateTimePicker",
  props: DateTimePickerProps,
  model: Schema.Struct({}),
  message: DateTimePickerMsg,
  events: DateTimePickerEvents
}).make({
  init: () => ({}),
  update: {
    DateChanged: ($, { date }) => {
      if ($.props.disabled) return $.model
      const parsed = parseDateTimeString($.props.value) ?? { date: "2026-01-01", time: "09:00" }
      if (parsePlainDate(date) === undefined) return $.model
      return $.emit(DateTimePickerEvents.ValueChanged({ value: formatDateTimeString(date, parsed.time) }))
    },
    TimeChanged: ($, { time }) => {
      if ($.props.disabled) return $.model
      const parsed = parseDateTimeString($.props.value) ?? { date: "2026-01-01", time: "09:00" }
      return $.emit(DateTimePickerEvents.ValueChanged({ value: formatDateTimeString(parsed.date, time) }))
    }
  },
  view: (h) => {
    const p = h.props
    const parsed = parseDateTimeString(p.value) ?? { date: "2026-01-01", time: "09:00" }
    const prefix = p.idPrefix ?? "datetime"
    const weekStart = firstDayOfWeek(p.locale ?? "en-US")

    return h.div
      .attrs({
        role: "group",
        "aria-label": p.label,
        "data-datetime-picker": "",
        "data-first-day-of-week": String(weekStart)
      })
      .children(
        h.input
          .attrs({
            id: `${prefix}-date`,
            type: "date",
            "aria-label": `${p.label} date`,
            ...(p.disabled ? { disabled: "" } : {})
          })
          .value(parsed.date)
          .on("input", ({ value }) => DateTimePickerMsg.DateChanged({ date: value })),
        TimeInput(h, {
          props: {
            label: `${p.label} time`,
            value: parsed.time,
            hourCycle: p.hourCycle,
            granularity: p.granularity,
            disabled: p.disabled,
            idPrefix: `${prefix}-time`
          },
          onEmit: {
            ValueChanged: ({ value }) => DateTimePickerMsg.TimeChanged({ time: value })
          }
        })
      )
  }
})
