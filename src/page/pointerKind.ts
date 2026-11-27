import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"

export type PointerKind = "fine" | "coarse"
export type InputModality = "keyboard" | "pointer" | "virtual"

export interface ModalityState {
  readonly pointerKind: PointerKind
  readonly modality: InputModality
}

/**
 * Resolves coarse vs fine primary pointer from media-query matches.
 */
export const resolvePointerKind = (
  coarseMatches: boolean,
  fineMatches = !coarseMatches
): PointerKind => (coarseMatches && !fineMatches ? "coarse" : "fine")

const MODIFIER_ONLY_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "NumLock",
  "ScrollLock"
])

/**
 * Returns `"keyboard"` when a key press should switch focus-ring modality to
 * keyboard navigation, or `undefined` for bare modifier keys.
 */
export const modalityFromKey = (
  key: string,
  modifiers: { readonly ctrl?: boolean; readonly alt?: boolean; readonly meta?: boolean } = {}
): InputModality | undefined => {
  if (MODIFIER_ONLY_KEYS.has(key)) return undefined
  if (modifiers.ctrl || modifiers.alt || modifiers.meta) return undefined
  return "keyboard"
}

/**
 * Classifies a pointer/click interaction as `"virtual"` (assistive tech
 * synthetic click with zero detail/dimensions) or `"pointer"`.
 */
export const modalityFromPointer = (input: {
  readonly pointerType?: string | undefined
  readonly detail?: number | undefined
  readonly width?: number | undefined
  readonly height?: number | undefined
}): InputModality => {
  if (
    input.pointerType === "" ||
    (input.detail === 0 && (input.width ?? 0) === 0 && (input.height ?? 0) === 0)
  ) {
    return "virtual"
  }
  return "pointer"
}

export interface InputModalityService {
  readonly get: Effect.Effect<ModalityState>
  readonly setPointerKind: (kind: PointerKind) => Effect.Effect<ModalityState>
  readonly recordKey: (
    key: string,
    modifiers?: { readonly ctrl?: boolean; readonly alt?: boolean; readonly meta?: boolean }
  ) => Effect.Effect<ModalityState>
  readonly recordPointer: (input: {
    readonly pointerType?: string | undefined
    readonly detail?: number | undefined
    readonly width?: number | undefined
    readonly height?: number | undefined
  }) => Effect.Effect<ModalityState>
}

export class InputModalityTracker extends Context.Service<
  InputModalityTracker,
  InputModalityService
>()("@effect-ui-page/InputModalityTracker") {}

export const makeInputModality = (
  initial: ModalityState = { pointerKind: "fine", modality: "pointer" }
): Effect.Effect<InputModalityService> =>
  Effect.gen(function*() {
    const ref = yield* Ref.make<ModalityState>(initial)

    return {
      get: Ref.get(ref),
      setPointerKind: (pointerKind) =>
        Ref.updateAndGet(ref, (s) =>
          s.pointerKind === pointerKind ? s : { ...s, pointerKind }
        ),
      recordKey: (key, modifiers) => {
        const next = modalityFromKey(key, modifiers)
        if (next === undefined) return Ref.get(ref)
        return Ref.updateAndGet(ref, (s) =>
          s.modality === next ? s : { ...s, modality: next }
        )
      },
      recordPointer: (input) => {
        const next = modalityFromPointer(input)
        const pointerKind: PointerKind | undefined =
          input.pointerType === "touch"
            ? "coarse"
            : input.pointerType === "mouse" || input.pointerType === "pen"
            ? "fine"
            : undefined
        return Ref.updateAndGet(ref, (s) => ({
          pointerKind: pointerKind ?? s.pointerKind,
          modality: next
        }))
      }
    }
  })

export const inputModalityLayer = (
  initial?: ModalityState
): Layer.Layer<InputModalityTracker> =>
  Layer.effect(InputModalityTracker, makeInputModality(initial))
