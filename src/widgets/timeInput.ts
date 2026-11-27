import { UiSchema } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import * as Schema from "effect/Schema"

export type TimeGranularity = "minute" | "second"
export type HourCycle = 12 | 24
export type TimeSegment = "hour" | "minute" | "second" | "period"

export interface ParsedTime {
  readonly hours: number
  readonly minutes: number
  readonly seconds: number
}

const pad2 = (n: number): string => String(n).padStart(2, "0")

export const parseTimeString = (raw: string): ParsedTime | undefined => {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim())
  if (m === null) return undefined
  const hours = Number.parseInt(m[1]!, 10)
  const minutes = Number.parseInt(m[2]!, 10)
  const seconds = m[3] === undefined ? 0 : Number.parseInt(m[3]!, 10)
  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return undefined
  }
  return { hours, minutes, seconds }
}

export const formatTimeString = (
  time: ParsedTime,
  granularity: TimeGranularity = "minute"
): string => {
  const base = `${pad2(time.hours)}:${pad2(time.minutes)}`
  return granularity === "second" ? `${base}:${pad2(time.seconds)}` : base
}

export const stepTimeSegment = (
  time: ParsedTime,
  segment: TimeSegment,
  delta: number
): ParsedTime => {
  const step = delta >= 0 ? Math.max(1, Math.floor(delta)) : Math.min(-1, Math.ceil(delta))
  switch (segment) {
    case "hour":
      return { ...time, hours: (((time.hours + step) % 24) + 24) % 24 }
    case "minute":
      return { ...time, minutes: (((time.minutes + step) % 60) + 60) % 60 }
    case "second":
      return { ...time, seconds: (((time.seconds + step) % 60) + 60) % 60 }
    case "period":
      return { ...time, hours: (time.hours + 12) % 24 }
  }
}

export const TimeInputProps = Schema.Struct({
  label: Schema.String,
  value: Schema.String,
  granularity: Schema.optional(Schema.Literals(["minute", "second"])),
  hourCycle: Schema.optional(Schema.Literals([12, 24])),
  disabled: Schema.optional(Schema.Boolean),
  idPrefix: Schema.optional(Schema.String)
})
export type TimeInputProps = typeof TimeInputProps.Type

export const TimeInputEvents = UiSchema.TaggedEnum({
  ValueChanged: { value: Schema.String }
})
export type TimeInputEvents = typeof TimeInputEvents.Type

const TimeInputMsg = UiSchema.TaggedEnum({
  Stepped: { segment: Schema.Literals(["hour", "minute", "second", "period"]), delta: Schema.Number },
  MovedSegment: { segment: Schema.Literals(["hour", "minute", "second", "period"]) },
  FocusDone: {}
})

const segmentRef = (seg: TimeSegment) => Html.ref(`TimeSegment[${seg}]`, "span")

/**
 * Accessible segmented time-of-day input (`HH:MM` or `HH:MM:SS`, 12-hour or
 * 24-hour cycle) using `role="spinbutton"` segments and Arrow key navigation.
 */
export const TimeInput = Html.component({
  name: "TimeInput",
  props: TimeInputProps,
  model: Schema.Struct({}),
  message: TimeInputMsg,
  events: TimeInputEvents
}).make({
  init: () => ({}),
  update: {
    Stepped: ($, { delta, segment }) => {
      if ($.props.disabled) return $.model
      const current = parseTimeString($.props.value) ?? { hours: 0, minutes: 0, seconds: 0 }
      const next = stepTimeSegment(current, segment, delta)
      const formatted = formatTimeString(next, $.props.granularity ?? "minute")
      return $.emit(TimeInputEvents.ValueChanged({ value: formatted }))
    },
    MovedSegment: ($, { segment }) =>
      $.run(HtmlCommand.focus(segmentRef(segment), () => TimeInputMsg.FocusDone())),
    FocusDone: ($) => $.model
  },
  view: (h) => {
    const p = h.props
    const granularity: TimeGranularity = p.granularity ?? "minute"
    const hourCycle: HourCycle = p.hourCycle ?? 24
    const prefix = p.idPrefix ?? "time"
    const parsed = parseTimeString(p.value) ?? { hours: 0, minutes: 0, seconds: 0 }

    const segments: ReadonlyArray<TimeSegment> = [
      "hour",
      "minute",
      ...(granularity === "second" ? (["second"] as const) : []),
      ...(hourCycle === 12 ? (["period"] as const) : [])
    ]

    const displayHour =
      hourCycle === 12 ? (parsed.hours % 12 === 0 ? 12 : parsed.hours % 12) : parsed.hours
    const periodText = parsed.hours >= 12 ? "PM" : "AM"

    const renderSeg = (seg: TimeSegment, idx: number) => {
      const label =
        seg === "hour"
          ? "Hour"
          : seg === "minute"
          ? "Minute"
          : seg === "second"
          ? "Second"
          : "AM/PM"
      const text =
        seg === "hour"
          ? pad2(displayHour)
          : seg === "minute"
          ? pad2(parsed.minutes)
          : seg === "second"
          ? pad2(parsed.seconds)
          : periodText
      const valNow =
        seg === "hour"
          ? displayHour
          : seg === "minute"
          ? parsed.minutes
          : seg === "second"
          ? parsed.seconds
          : parsed.hours >= 12
          ? 1
          : 0
      const valMin = seg === "hour" ? (hourCycle === 12 ? 1 : 0) : 0
      const valMax =
        seg === "hour" ? (hourCycle === 12 ? 12 : 23) : seg === "period" ? 1 : 59

      return h.span
        .key(seg)
        .ref(segmentRef(seg))
        .attrs({
          id: `${prefix}-${seg}`,
          role: "spinbutton",
          "aria-label": label,
          "aria-valuenow": String(valNow),
          "aria-valuemin": String(valMin),
          "aria-valuemax": String(valMax),
          "aria-valuetext": text,
          tabindex: p.disabled ? "-1" : "0",
          ...(p.disabled ? { "aria-disabled": "true", "data-disabled": "" } : {})
        })
        .on(
          "keydown",
          ({ key }) => {
            if (p.disabled) return undefined
            if (key === "ArrowUp") return TimeInputMsg.Stepped({ segment: seg, delta: 1 })
            if (key === "ArrowDown") return TimeInputMsg.Stepped({ segment: seg, delta: -1 })
            if (key === "PageUp") return TimeInputMsg.Stepped({ segment: seg, delta: seg === "hour" ? 2 : 10 })
            if (key === "PageDown") return TimeInputMsg.Stepped({ segment: seg, delta: seg === "hour" ? -2 : -10 })
            if (key === "ArrowRight" && idx < segments.length - 1) {
              return TimeInputMsg.MovedSegment({ segment: segments[idx + 1]! })
            }
            if (key === "ArrowLeft" && idx > 0) {
              return TimeInputMsg.MovedSegment({ segment: segments[idx - 1]! })
            }
            return undefined
          },
          { preventDefault: true }
        )
        .children(text)
    }

    return h.div
      .attrs({ role: "group", "aria-label": p.label, "data-time-input": "" })
      .children(
        renderSeg("hour", 0),
        h.span.attrs({ "aria-hidden": "true" }).children(":"),
        renderSeg("minute", 1),
        ...(granularity === "second"
          ? [
              h.span.attrs({ "aria-hidden": "true" }).children(":"),
              renderSeg("second", 2)
            ]
          : []),
        ...(hourCycle === 12
          ? [
              h.span.attrs({ "aria-hidden": "true" }).children(" "),
              renderSeg("period", segments.length - 1)
            ]
          : [])
      )
  }
})
