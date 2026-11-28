import { UiSchema } from "@effect/ui"
import { Html, HtmlCommand, HtmlSubscription } from "@effect/ui/html"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

export const CropRectSchema = Schema.Struct({
  /** Normalized `[0, 1]` left offset within the source image. */
  x: Schema.Number,
  /** Normalized `[0, 1]` top offset within the source image. */
  y: Schema.Number,
  /** Normalized `(0, 1]` crop width within the source image. */
  width: Schema.Number,
  /** Normalized `(0, 1]` crop height within the source image. */
  height: Schema.Number
})
export type CropRect = typeof CropRectSchema.Type

export interface PixelCropRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface CropConstraints {
  readonly minWidth?: number | undefined
  readonly minHeight?: number | undefined
  /** Desired `width / height` ratio in pixel space (requires `imageWidth` & `imageHeight`). */
  readonly aspectRatio?: number | undefined
  readonly imageWidth?: number | undefined
  readonly imageHeight?: number | undefined
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

/**
 * Clamps a normalized crop rectangle into `[0, 1]`, enforcing minimum size and
 * optional aspect ratio lock.
 */
export const clampCropRect = (
  rect: CropRect,
  constraints: CropConstraints = {}
): CropRect => {
  const minW = clamp01(constraints.minWidth ?? 0.05)
  const minH = clamp01(constraints.minHeight ?? 0.05)
  let width = Math.max(minW, Math.min(1, rect.width))
  let height = Math.max(minH, Math.min(1, rect.height))

  if (constraints.aspectRatio !== undefined && constraints.aspectRatio > 0) {
    const imgW = constraints.imageWidth ?? 1
    const imgH = constraints.imageHeight ?? 1
    // Normalized width/height ratio accounting for source image aspect
    const normRatio = constraints.aspectRatio * (imgH / imgW)
    height = width / normRatio
    if (height > 1) {
      height = 1
      width = Math.min(1, height * normRatio)
    }
    if (height < minH) {
      height = minH
      width = Math.min(1, height * normRatio)
    }
    if (width < minW) {
      width = minW
      height = Math.min(1, width / normRatio)
    }
  }

  const x = Math.max(0, Math.min(1 - width, rect.x))
  const y = Math.max(0, Math.min(1 - height, rect.y))
  return {
    x: Math.round(x * 10000) / 10000,
    y: Math.round(y * 10000) / 10000,
    width: Math.round(width * 10000) / 10000,
    height: Math.round(height * 10000) / 10000
  }
}

export const moveCropRect = (
  rect: CropRect,
  dx: number,
  dy: number,
  constraints?: CropConstraints
): CropRect =>
  clampCropRect(
    { ...rect, x: rect.x + dx, y: rect.y + dy },
    constraints
  )

export const resizeCropRect = (
  rect: CropRect,
  dw: number,
  dh: number,
  constraints?: CropConstraints
): CropRect =>
  clampCropRect(
    { ...rect, width: rect.width + dw, height: rect.height + dh },
    constraints
  )

/**
 * Zooms the crop window symmetrically around its center (`factor > 1` zooms in
 * by shrinking the crop window; `factor < 1` zooms out).
 */
export const zoomCropRect = (
  rect: CropRect,
  factor: number,
  constraints?: CropConstraints
): CropRect => {
  if (factor <= 0) return rect
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const nextW = rect.width / factor
  const nextH = rect.height / factor
  return clampCropRect(
    { x: cx - nextW / 2, y: cy - nextH / 2, width: nextW, height: nextH },
    constraints
  )
}

/** Converts a normalized `[0, 1]` crop rectangle to integer source-image pixels. */
export const cropToPixels = (
  rect: CropRect,
  imageWidth: number,
  imageHeight: number
): PixelCropRect => ({
  x: Math.round(rect.x * imageWidth),
  y: Math.round(rect.y * imageHeight),
  width: Math.max(1, Math.round(rect.width * imageWidth)),
  height: Math.max(1, Math.round(rect.height * imageHeight))
})

export const ImageCropperProps = Schema.Struct({
  label: Schema.String,
  src: Schema.String,
  alt: Schema.String,
  imageWidth: Schema.Number,
  imageHeight: Schema.Number,
  crop: Schema.optional(CropRectSchema),
  aspectRatio: Schema.optional(Schema.Number),
  step: Schema.optional(Schema.Number),
  minWidth: Schema.optional(Schema.Number),
  minHeight: Schema.optional(Schema.Number),
  idPrefix: Schema.optional(Schema.String)
})
export type ImageCropperProps = typeof ImageCropperProps.Type

export const ImageCropperEvents = UiSchema.TaggedEnum({
  CropChanged: { crop: CropRectSchema }
})
export type ImageCropperEvents = typeof ImageCropperEvents.Type

const CropperDragSchema = Schema.Struct({
  pointerId: Schema.Number,
  startX: Schema.Number,
  startY: Schema.Number,
  startCrop: CropRectSchema,
  width: Schema.Number,
  height: Schema.Number
})

const ImageCropperModel = Schema.Struct({
  crop: CropRectSchema,
  drag: Schema.NullOr(CropperDragSchema)
})

const ImageCropperMsg = UiSchema.TaggedEnum({
  Move: { dx: Schema.Number, dy: Schema.Number },
  Resize: { dw: Schema.Number, dh: Schema.Number },
  Zoom: { factor: Schema.Number },
  Reset: {},
  DragStart: { pointerId: Schema.Number, x: Schema.Number, y: Schema.Number },
  ContainerMeasured: { width: Schema.Number, height: Schema.Number },
  DragMove: { pointerId: Schema.Number, x: Schema.Number, y: Schema.Number },
  DragEnd: { pointerId: Schema.optional(Schema.Number) }
})

const containerRef = Html.ref("ImageCropperRoot", "div")

const DEFAULT_CROP: CropRect = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }

const SR_ONLY_STYLE =
  "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0"

const constraintsOf = (props: ImageCropperProps): CropConstraints => ({
  minWidth: props.minWidth,
  minHeight: props.minHeight,
  aspectRatio: props.aspectRatio,
  imageWidth: props.imageWidth,
  imageHeight: props.imageHeight
})

/**
 * Headless accessible ImageCropper widget with pointer drag, keyboard pan
 * (Arrow keys), keyboard resize (Shift+Arrow), zoom (`+`/`-`), reset (`0`),
 * aspect-ratio locking, and pixel-space conversion (`cropToPixels`).
 */
export const ImageCropper = Html.component({
  name: "ImageCropper",
  props: ImageCropperProps,
  model: ImageCropperModel,
  message: ImageCropperMsg,
  events: ImageCropperEvents
}).make({
  init: ($) => ({
    crop: clampCropRect($.props.crop ?? DEFAULT_CROP, constraintsOf($.props)),
    drag: null
  }),
  subscriptions: ($) =>
    $.model.drag === null
      ? []
      : [
          HtmlSubscription.onDocument("pointerup", ({ pointerId }) =>
            ImageCropperMsg.DragEnd({ pointerId })
          ),
          HtmlSubscription.onDocument("pointercancel", ({ pointerId }) =>
            ImageCropperMsg.DragEnd({ pointerId })
          ),
          HtmlSubscription.onWindow("blur", () => ImageCropperMsg.DragEnd({}))
        ],
  update: {
    Move: ($, { dx, dy }) => {
      const current = $.props.crop ?? $.model.crop
      const next = moveCropRect(current, dx, dy, constraintsOf($.props))
      return $.evolve({ crop: next }).emit(ImageCropperEvents.CropChanged({ crop: next }))
    },
    Resize: ($, { dw, dh }) => {
      const current = $.props.crop ?? $.model.crop
      const next = resizeCropRect(current, dw, dh, constraintsOf($.props))
      return $.evolve({ crop: next }).emit(ImageCropperEvents.CropChanged({ crop: next }))
    },
    Zoom: ($, { factor }) => {
      const current = $.props.crop ?? $.model.crop
      const next = zoomCropRect(current, factor, constraintsOf($.props))
      return $.evolve({ crop: next }).emit(ImageCropperEvents.CropChanged({ crop: next }))
    },
    Reset: ($) => {
      const next = clampCropRect(DEFAULT_CROP, constraintsOf($.props))
      return $.evolve({ crop: next }).emit(ImageCropperEvents.CropChanged({ crop: next }))
    },
    DragStart: ($, { pointerId, x, y }) => {
      const startCrop = clampCropRect($.props.crop ?? $.model.crop, constraintsOf($.props))
      return $.evolve({
        drag: {
          pointerId,
          startX: x,
          startY: y,
          startCrop,
          width: Math.max(1, $.props.imageWidth),
          height: Math.max(1, $.props.imageHeight)
        }
      }).run(
        HtmlCommand.measure(containerRef, (rect) =>
          ImageCropperMsg.ContainerMeasured({
            width: Option.isSome(rect) && rect.value.width > 0 ? rect.value.width : $.props.imageWidth,
            height: Option.isSome(rect) && rect.value.height > 0 ? rect.value.height : $.props.imageHeight
          })
        )
      )
    },
    ContainerMeasured: ($, { height, width }) =>
      $.model.drag === null
        ? $.model
        : $.evolve({
            drag: {
              ...$.model.drag,
              width: Math.max(1, width),
              height: Math.max(1, height)
            }
          }),
    DragMove: ($, { pointerId, x, y }) => {
      const drag = $.model.drag
      if (drag === null || drag.pointerId !== pointerId) return $.model
      const dx = (x - drag.startX) / drag.width
      const dy = (y - drag.startY) / drag.height
      const next = moveCropRect(drag.startCrop, dx, dy, constraintsOf($.props))
      return $.evolve({ crop: next }).emit(ImageCropperEvents.CropChanged({ crop: next }))
    },
    DragEnd: ($, { pointerId }) =>
      $.model.drag !== null &&
      (pointerId === undefined || $.model.drag.pointerId === pointerId)
        ? $.evolve({ drag: null })
        : $.model
  },
  view: (h, model) => {
    const p = h.props
    const crop = clampCropRect(p.crop ?? model.crop, constraintsOf(p))
    const px = cropToPixels(crop, p.imageWidth, p.imageHeight)
    const step = p.step ?? 0.05
    const prefix = p.idPrefix ?? "cropper"
    const instructionsId = `${prefix}-instructions`

    return h.div
      .ref(containerRef)
      .attrs({
        role: "group",
        "aria-label": p.label,
        "data-image-cropper": ""
      })
      .children(
        h.span
          .attrs({ id: instructionsId, style: SR_ONLY_STYLE })
          .children(
            "Use arrow keys to move crop region, Shift plus arrow keys to resize, plus and minus to zoom, 0 to reset."
          ),
        h.img.attrs({
          src: p.src,
          alt: p.alt,
          "data-cropper-image": ""
        }),
        h.div
          .attrs({
            role: "application",
            tabindex: "0",
            "aria-label": `${p.label} crop selection: ${px.width} by ${px.height} pixels at ${px.x}, ${px.y}`,
            "aria-describedby": instructionsId,
            "aria-roledescription": "crop region",
            "data-cropper-region": "",
            "data-crop-x": String(crop.x),
            "data-crop-y": String(crop.y),
            "data-crop-width": String(crop.width),
            "data-crop-height": String(crop.height),
            ...(model.drag !== null ? { "data-dragging": "true" } : {})
          })
          .style({
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.width * 100}%`,
            height: `${crop.height * 100}%`
          })
          .on(
            "pointerdown",
            ({ button, pointerId, x, y }) =>
              button === 0
                ? ImageCropperMsg.DragStart({ pointerId, x, y })
                : undefined,
            { capturePointer: true, preventDefault: true }
          )
          .on("pointermove", ({ pointerId, x, y }) =>
            model.drag !== null && model.drag.pointerId === pointerId
              ? ImageCropperMsg.DragMove({ pointerId, x, y })
              : undefined
          )
          .on("pointerup", ({ pointerId }) =>
            model.drag !== null && model.drag.pointerId === pointerId
              ? ImageCropperMsg.DragEnd({ pointerId })
              : undefined
          )
          .on("pointercancel", ({ pointerId }) =>
            model.drag !== null && model.drag.pointerId === pointerId
              ? ImageCropperMsg.DragEnd({ pointerId })
              : undefined
          )
          .on(
            "keydown",
            ({ key, shift }) => {
              if (key === "ArrowLeft") {
                return shift
                  ? ImageCropperMsg.Resize({ dw: -step, dh: 0 })
                  : ImageCropperMsg.Move({ dx: -step, dy: 0 })
              }
              if (key === "ArrowRight") {
                return shift
                  ? ImageCropperMsg.Resize({ dw: step, dh: 0 })
                  : ImageCropperMsg.Move({ dx: step, dy: 0 })
              }
              if (key === "ArrowUp") {
                return shift
                  ? ImageCropperMsg.Resize({ dw: 0, dh: -step })
                  : ImageCropperMsg.Move({ dx: 0, dy: -step })
              }
              if (key === "ArrowDown") {
                return shift
                  ? ImageCropperMsg.Resize({ dw: 0, dh: step })
                  : ImageCropperMsg.Move({ dx: 0, dy: step })
              }
              if (key === "+" || key === "=") return ImageCropperMsg.Zoom({ factor: 1.1 })
              if (key === "-") return ImageCropperMsg.Zoom({ factor: 1 / 1.1 })
              if (key === "0") return ImageCropperMsg.Reset()
              return undefined
            },
            { preventDefault: true }
          )
          .children(
            h.span
              .attrs({ "data-cropper-readout": "", "aria-live": "polite" })
              .children(`${px.width}\u00d7${px.height}`)
          )
      )
  }
})
