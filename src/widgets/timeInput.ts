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
  dir: Schema.optional(Schema.Literals(["ltr", "rtl"])),
  disabled: Schema.optional(Schema.Boolean),
  idPrefix: Schema.optional(Schema.String)
})
export type TimeInputProps = typeof TimeInputProps.Type

export const TimeInputEvents = UiSchema.TaggedEnum({
  ValueChanged: { value: Schema.String }
})
export type TimeInputEvents = typeof TimeInputEvents.Type

const SegmentLiteral = Schema.Literals(["hour", "minute", "second", "period"])

const TimeInputMsg = UiSchema.TaggedEnum({
  Stepped: { segment: SegmentLiteral, delta: Schema.Number },
  SetEdge: { segment: SegmentLiteral, edge: Schema.Literals(["min", "max"]) },
  TypedDigit: { segment: SegmentLiteral, digit: Schema.Number },
  SetPeriod: { pm: Schema.Boolean },
  MovedSegment: { segment: SegmentLiteral },
  ClearedBuffer: {},
  DragStarted: { segment: SegmentLiteral, pointerId: Schema.Number, y: Schema.Number },
  DragMoved: { pointerId: Schema.Number, y: Schema.Number },
  DragEnded: { pointerId: Schema.Number },
  FocusDone: {}
})

const segmentRef = (seg: TimeSegment) => Html.ref(`TimeSegment[${seg}]`, "span")

const applyNumericValue = (
  current: ParsedTime,
  segment: TimeSegment,
  rawNumber: number,
  hourCycle: HourCycle
): ParsedTime => {
  if (segment === "hour") {
    if (hourCycle === 12) {
      const clamped = Math.max(1, Math.min(12, rawNumber === 0 ? 12 : rawNumber))
      const isPm = current.hours >= 12
      const h24 = (clamped % 12) + (isPm ? 12 : 0)
      return { ...current, hours: h24 }
    }
    return { ...current, hours: Math.max(0, Math.min(23, rawNumber)) }
  }
  if (segment === "minute") {
    return { ...current, minutes: Math.max(0, Math.min(59, rawNumber)) }
  }
  if (segment === "second") {
    return { ...current, seconds: Math.max(0, Math.min(59, rawNumber)) }
  }
  return current
}

/**
 * Accessible segmented time-of-day input (`HH:MM` or `HH:MM:SS`, 12-hour or
 * 24-hour cycle) using `role="spinbutton"` segments with Arrow/Home/End keys,
 * 2-digit numeric typing, `a`/`p` or click period toggle, and vertical pointer drag.
 */
export const TimeInput = Html.component({
  name: "TimeInput",
  props: TimeInputProps,
  model: Schema.Struct({
    bufferSeg: Schema.NullOr(SegmentLiteral),
    bufferDigits: Schema.String,
    drag: Schema.NullOr(
      Schema.Struct({
        segment: SegmentLiteral,
        pointerId: Schema.Number,
        lastY: Schema.Number
      })
    )
  }),
  message: TimeInputMsg,
  events: TimeInputEvents
}).make({
  init: () => ({ bufferSeg: null, bufferDigits: "", drag: null }),
  update: {
    Stepped: ($, { delta, segment }) => {
      if ($.props.disabled) return $.model
      const current = parseTimeString($.props.value) ?? { hours: 0, minutes: 0, seconds: 0 }
      const next = stepTimeSegment(current, segment, delta)
      const formatted = formatTimeString(next, $.props.granularity ?? "minute")
      return $.evolve({ bufferSeg: null, bufferDigits: "" }).emit(
        TimeInputEvents.ValueChanged({ value: formatted })
      )
    },
    SetEdge: ($, { edge, segment }) => {
      if ($.props.disabled) return $.model
      const current = parseTimeString($.props.value) ?? { hours: 0, minutes: 0, seconds: 0 }
      const isPm = current.hours >= 12
      const hourCycle: HourCycle = $.props.hourCycle ?? 24
      const next: ParsedTime =
        segment === "hour"
          ? {
              ...current,
              hours:
                hourCycle === 12
                  ? edge === "min"
                    ? (isPm ? 13 : 1)
                    : (isPm ? 12 : 0)
                  : edge === "min"
                  ? 0
                  : 23
            }
          : segment === "minute"
          ? { ...current, minutes: edge === "min" ? 0 : 59 }
          : segment === "second"
          ? { ...current, seconds: edge === "min" ? 0 : 59 }
          : { ...current, hours: (current.hours % 12) + (edge === "min" ? 0 : 12) }
      const formatted = formatTimeString(next, $.props.granularity ?? "minute")
      return $.evolve({ bufferSeg: null, bufferDigits: "" }).emit(
        TimeInputEvents.ValueChanged({ value: formatted })
      )
    },
    TypedDigit: ($, { digit, segment }) => {
      if ($.props.disabled || segment === "period") return $.model
      const hourCycle: HourCycle = $.props.hourCycle ?? 24
      const maxVal = segment === "hour" ? (hourCycle === 12 ? 12 : 23) : 59
      const prev = $.model.bufferSeg === segment ? $.model.bufferDigits : ""
      const combined = prev.length === 1 ? `${prev}${digit}` : `${digit}`
      const combinedNum = Number.parseInt(combined, 10)
      const useCombined = combined.length === 2 && combinedNum <= maxVal
      const valueNum = useCombined ? combinedNum : digit
      const nextBuffer = useCombined
        ? ""
        : digit * 10 > maxVal
        ? ""
        : String(digit)
      const current = parseTimeString($.props.value) ?? { hours: 0, minutes: 0, seconds: 0 }
      const next = applyNumericValue(current, segment, valueNum, hourCycle)
      const formatted = formatTimeString(next, $.props.granularity ?? "minute")
      return $.evolve({
        bufferSeg: nextBuffer === "" ? null : segment,
        bufferDigits: nextBuffer
      }).emit(TimeInputEvents.ValueChanged({ value: formatted }))
    },
    SetPeriod: ($, { pm }) => {
      if ($.props.disabled) return $.model
      const current = parseTimeString($.props.value) ?? { hours: 0, minutes: 0, seconds: 0 }
      const nextHours = (current.hours % 12) + (pm ? 12 : 0)
      const formatted = formatTimeString(
        { ...current, hours: nextHours },
        $.props.granularity ?? "minute"
      )
      return $.evolve({ bufferSeg: null, bufferDigits: "" }).emit(
        TimeInputEvents.ValueChanged({ value: formatted })
      )
    },
    MovedSegment: ($, { segment }) =>
      $.evolve({ bufferSeg: null, bufferDigits: "" }).run(
        HtmlCommand.focus(segmentRef(segment), () => TimeInputMsg.FocusDone())
      ),
    ClearedBuffer: ($) => $.evolve({ bufferSeg: null, bufferDigits: "" }),
    DragStarted: ($, { pointerId, segment, y }) =>
      $.props.disabled
        ? $.model
        : $.evolve({ drag: { segment, pointerId, lastY: y } }),
    DragMoved: ($, { pointerId, y }) => {
      const drag = $.model.drag
      if (drag === null || drag.pointerId !== pointerId || $.props.disabled) {
        return $.model
      }
      const dy = drag.lastY - y
      const steps = Math.trunc(dy / 16)
      if (steps === 0) return $.model
      const current = parseTimeString($.props.value) ?? { hours: 0, minutes: 0, seconds: 0 }
      const next = stepTimeSegment(current, drag.segment, steps)
      const formatted = formatTimeString(next, $.props.granularity ?? "minute")
      return $.evolve({
        drag: { ...drag, lastY: drag.lastY - steps * 16 }
      }).emit(TimeInputEvents.ValueChanged({ value: formatted }))
    },
    DragEnded: ($, { pointerId }) =>
      $.model.drag !== null && $.model.drag.pointerId === pointerId
        ? $.evolve({ drag: null })
        : $.model,
    FocusDone: ($) => $.model
  },
  view: (h, model) => {
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
          "data-segment": seg,
          "aria-label": label,
          "aria-valuenow": String(valNow),
          "aria-valuemin": String(valMin),
          "aria-valuemax": String(valMax),
          "aria-valuetext": text,
          tabindex: p.disabled ? "-1" : "0",
          ...(p.disabled ? { "aria-disabled": "true", "data-disabled": "" } : {})
        })
        .on("blur", () => TimeInputMsg.ClearedBuffer())
        .on("click", () =>
          !p.disabled && seg === "period"
            ? TimeInputMsg.Stepped({ segment: "period", delta: 1 })
            : undefined
        )
        .on(
          "pointerdown",
          ({ button, pointerId, y }) =>
            !p.disabled && seg !== "period" && button === 0
              ? TimeInputMsg.DragStarted({ segment: seg, pointerId, y })
              : undefined,
          { capturePointer: true }
        )
        .on("pointermove", ({ pointerId, y }) =>
          model.drag !== null && model.drag.pointerId === pointerId
            ? TimeInputMsg.DragMoved({ pointerId, y })
            : undefined
        )
        .on("pointerup", ({ pointerId }) => TimeInputMsg.DragEnded({ pointerId }))
        .on("pointercancel", ({ pointerId }) => TimeInputMsg.DragEnded({ pointerId }))
        .on(
          "keydown",
          ({ key }) => {
            if (p.disabled) return undefined
            const isRtl = p.dir === "rtl"
            const nextKey = isRtl ? "ArrowLeft" : "ArrowRight"
            const prevKey = isRtl ? "ArrowRight" : "ArrowLeft"
            if (key === "ArrowUp") return TimeInputMsg.Stepped({ segment: seg, delta: 1 })
            if (key === "ArrowDown") return TimeInputMsg.Stepped({ segment: seg, delta: -1 })
            if (key === "PageUp") return TimeInputMsg.Stepped({ segment: seg, delta: seg === "hour" ? 2 : 10 })
            if (key === "PageDown") return TimeInputMsg.Stepped({ segment: seg, delta: seg === "hour" ? -2 : -10 })
            if (key === "Home") return TimeInputMsg.SetEdge({ segment: seg, edge: "min" })
            if (key === "End") return TimeInputMsg.SetEdge({ segment: seg, edge: "max" })
            if (seg === "period") {
              const lower = key.toLowerCase()
              if (lower === "a") return TimeInputMsg.SetPeriod({ pm: false })
              if (lower === "p") return TimeInputMsg.SetPeriod({ pm: true })
              if (key === " " || key === "Enter") {
                return TimeInputMsg.Stepped({ segment: "period", delta: 1 })
              }
            } else if (/^[0-9]$/.test(key)) {
              return TimeInputMsg.TypedDigit({
                segment: seg,
                digit: Number.parseInt(key, 10)
              })
            }
            if (key === nextKey && idx < segments.length - 1) {
              return TimeInputMsg.MovedSegment({ segment: segments[idx + 1]! })
            }
            if (key === prevKey && idx > 0) {
              return TimeInputMsg.MovedSegment({ segment: segments[idx - 1]! })
            }
            return undefined
          },
          { preventDefault: true }
        )
        .children(text)
    }

    return h.div
      .attrs({
        role: "group",
        "aria-label": p.label,
        ...(p.dir !== undefined ? { dir: p.dir } : {}),
        "data-time-input": ""
      })
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
