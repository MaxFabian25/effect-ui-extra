import { Match } from "effect"
import { findSnapIndex, rubberBand } from "./kinematics.js"

export type SheetPhase = "closed" | "dragging" | "snapping" | "open"

export interface SheetConfig {
  /** Sorted ascending open snap heights in pixels (e.g. `[240, 560]`). */
  readonly snapPoints: ReadonlyArray<number>
  /** Whether dragging below the lowest snap point can dismiss to `0`. Defaults to `true`. */
  readonly dismissible?: boolean | undefined
  /** Rubber-band resistance dimension in pixels. Defaults to `220`. */
  readonly resistance?: number | undefined
}

export interface SheetState {
  readonly phase: SheetPhase
  readonly position: number
  readonly snapIndex: number
  readonly velocity: number
  /** Undamped finger position tracked during `"dragging"` so `rubberBand` never compounds per frame. */
  readonly rawPosition?: number | undefined
}

export type SheetEvent =
  | { readonly _tag: "Open"; readonly snapIndex?: number | undefined }
  | { readonly _tag: "Close" }
  | { readonly _tag: "DragStart"; readonly currentPosition?: number | undefined }
  | { readonly _tag: "DragMove"; readonly delta: number; readonly velocity: number }
  | { readonly _tag: "DragEnd"; readonly velocity: number }
  | { readonly _tag: "DragCancel" }
  | { readonly _tag: "Settled" }

export const initialSheetState = (
  config: SheetConfig,
  openIndex?: number
): SheetState => {
  if (openIndex === undefined || config.snapPoints.length === 0) {
    return { phase: "closed", position: 0, snapIndex: -1, velocity: 0 }
  }
  const idx = Math.max(0, Math.min(config.snapPoints.length - 1, openIndex))
  return {
    phase: "open",
    position: config.snapPoints[idx] ?? 0,
    snapIndex: idx,
    velocity: 0
  }
}

/**
 * Pure Elm-friendly state machine for draggable bottom sheets and drawers.
 */
export const reduceSheet = (
  state: SheetState,
  event: SheetEvent,
  config: SheetConfig
): SheetState => {
  const snaps = config.snapPoints
  const dismissible = config.dismissible ?? true
  const maxPos = snaps[snaps.length - 1] ?? 0
  const minPos = dismissible ? 0 : (snaps[0] ?? 0)

  return Match.value(event).pipe(
    Match.tagsExhaustive({
      Open: (ev) => {
        if (snaps.length === 0) return state
        const idx = Math.max(
          0,
          Math.min(snaps.length - 1, ev.snapIndex ?? snaps.length - 1)
        )
        return {
          phase: "snapping" as const,
          position: snaps[idx] ?? 0,
          snapIndex: idx,
          velocity: 0
        }
      },
      Close: () => ({
        phase: "snapping" as const,
        position: 0,
        snapIndex: -1,
        velocity: 0
      }),
      DragStart: (ev) => {
        const startPos = ev.currentPosition ?? state.position
        return {
          phase: "dragging" as const,
          position: startPos,
          rawPosition: startPos,
          snapIndex: state.snapIndex,
          velocity: 0
        }
      },
      DragMove: (ev) => {
        if (state.phase !== "dragging") return state
        const nextRaw = (state.rawPosition ?? state.position) + ev.delta
        const next = rubberBand(
          nextRaw,
          minPos,
          maxPos,
          config.resistance ?? 220
        )
        return {
          phase: "dragging" as const,
          position: next,
          rawPosition: nextRaw,
          snapIndex: state.snapIndex,
          velocity: ev.velocity
        }
      },
      DragEnd: (ev) => {
        const targets = dismissible ? [0, ...snaps] : [...snaps]
        if (targets.length === 0) {
          return { phase: "closed" as const, position: 0, snapIndex: -1, velocity: 0 }
        }
        const picked = findSnapIndex(state.position, ev.velocity, targets)
        const targetPos = targets[picked] ?? 0
        const snapIndex = dismissible ? picked - 1 : picked
        return {
          phase: "snapping" as const,
          position: targetPos,
          snapIndex,
          velocity: ev.velocity
        }
      },
      DragCancel: () => {
        if (state.phase !== "dragging") return state
        const targetPos =
          state.snapIndex >= 0 && state.snapIndex < snaps.length
            ? (snaps[state.snapIndex] ?? 0)
            : 0
        return {
          phase: "snapping" as const,
          position: targetPos,
          snapIndex: state.snapIndex,
          velocity: 0
        }
      },
      Settled: () => ({
        phase: state.snapIndex < 0 ? ("closed" as const) : ("open" as const),
        position: state.position,
        snapIndex: state.snapIndex,
        velocity: 0
      })
    })
  )
}

/**
 * Smooth backdrop dim progress in `[0, 1]` relative to the sheet's highest snap
 * point.
 */
export const sheetBackdropProgress = (
  position: number,
  maxSnap: number
): number => {
  if (maxSnap <= 0) return 0
  return Math.max(0, Math.min(1, position / maxSnap))
}
