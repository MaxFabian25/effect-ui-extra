import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
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
  minHeight: Schema.optional(Schema.Number)
})
export type ImageCropperProps = typeof ImageCropperProps.Type

export const ImageCropperEvents = UiSchema.TaggedEnum({
  CropChanged: { crop: CropRectSchema }
})
export type ImageCropperEvents = typeof ImageCropperEvents.Type

const ImageCropperMsg = UiSchema.TaggedEnum({
  Move: { dx: Schema.Number, dy: Schema.Number },
  Resize: { dw: Schema.Number, dh: Schema.Number },
  Zoom: { factor: Schema.Number },
  Reset: {}
})

const DEFAULT_CROP: CropRect = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }

const constraintsOf = (props: ImageCropperProps): CropConstraints => ({
  minWidth: props.minWidth,
  minHeight: props.minHeight,
  aspectRatio: props.aspectRatio,
  imageWidth: props.imageWidth,
  imageHeight: props.imageHeight
})

/**
 * Headless accessible ImageCropper widget with keyboard pan (Arrow keys),
 * keyboard resize (Shift+Arrow), zoom (`+`/`-`), reset (`0`), aspect-ratio
 * locking, and pixel-space conversion (`cropToPixels`).
 */
export const ImageCropper = Html.component({
  name: "ImageCropper",
  props: ImageCropperProps,
  model: CropRectSchema,
  message: ImageCropperMsg,
  events: ImageCropperEvents
}).make({
  init: ($) => clampCropRect($.props.crop ?? DEFAULT_CROP, constraintsOf($.props)),
  update: {
    Move: ($, { dx, dy }) => {
      const current = $.props.crop ?? $.model
      const next = moveCropRect(current, dx, dy, constraintsOf($.props))
      return $.evolve(next).emit(ImageCropperEvents.CropChanged({ crop: next }))
    },
    Resize: ($, { dw, dh }) => {
      const current = $.props.crop ?? $.model
      const next = resizeCropRect(current, dw, dh, constraintsOf($.props))
      return $.evolve(next).emit(ImageCropperEvents.CropChanged({ crop: next }))
    },
    Zoom: ($, { factor }) => {
      const current = $.props.crop ?? $.model
      const next = zoomCropRect(current, factor, constraintsOf($.props))
      return $.evolve(next).emit(ImageCropperEvents.CropChanged({ crop: next }))
    },
    Reset: ($) => {
      const next = clampCropRect(DEFAULT_CROP, constraintsOf($.props))
      return $.evolve(next).emit(ImageCropperEvents.CropChanged({ crop: next }))
    }
  },
  view: (h, model) => {
    const p = h.props
    const crop = clampCropRect(p.crop ?? model, constraintsOf(p))
    const px = cropToPixels(crop, p.imageWidth, p.imageHeight)
    const step = p.step ?? 0.05

    return h.div
      .attrs({
        role: "group",
        "aria-label": p.label,
        "data-image-cropper": ""
      })
      .children(
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
            "aria-roledescription": "crop region",
            "data-cropper-region": "",
            "data-crop-x": String(crop.x),
            "data-crop-y": String(crop.y),
            "data-crop-width": String(crop.width),
            "data-crop-height": String(crop.height)
          })
          .style({
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.width * 100}%`,
            height: `${crop.height * 100}%`
          })
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
              .children(`${px.width}x${px.height}`)
          )
      )
  }
})
