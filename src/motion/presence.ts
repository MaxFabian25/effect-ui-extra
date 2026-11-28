import { Match } from "effect"

export type PresencePhase =
  | "unmounted"
  | "entering"
  | "open"
  | "exiting"

export interface PresenceState {
  readonly phase: PresencePhase
  readonly mounted: boolean
  readonly dataState: "open" | "closed"
}

export type PresenceEvent =
  | {
      readonly _tag: "SetOpen"
      readonly open: boolean
      readonly reducedMotion?: boolean | undefined
      /** `"instant"` (default) skips enter/exit phases; `"fade"` keeps phases so gentle opacity fades can complete. */
      readonly reducedMotionMode?: "instant" | "fade" | undefined
    }
  | { readonly _tag: "EnterFrame" }
  | { readonly _tag: "AnimationEnd" }

export const initialPresenceState = (open: boolean): PresenceState => ({
  phase: open ? "open" : "unmounted",
  mounted: open,
  dataState: open ? "open" : "closed"
})

/**
 * Pure mount/enter/exit lifecycle state machine for dialogs, popovers, toasts,
 * and drawers. Honors `reducedMotion: true` by skipping `"entering"` and
 * `"exiting"` phases immediately unless `reducedMotionMode: "fade"` is passed
 * for gentle opacity crossfades.
 */
export const reducePresence = (
  state: PresenceState,
  event: PresenceEvent
): PresenceState =>
  Match.value(event).pipe(
    Match.tagsExhaustive({
      SetOpen: (ev) => {
        const skipPhases =
          ev.reducedMotion === true && ev.reducedMotionMode !== "fade"
        if (ev.open) {
          if (state.phase === "open") return state
          if (skipPhases) {
            return { phase: "open" as const, mounted: true, dataState: "open" as const }
          }
          return { phase: "entering" as const, mounted: true, dataState: "closed" as const }
        }
        if (state.phase === "unmounted") return state
        if (skipPhases) {
          return { phase: "unmounted" as const, mounted: false, dataState: "closed" as const }
        }
        return { phase: "exiting" as const, mounted: true, dataState: "closed" as const }
      },
      EnterFrame: () =>
        state.phase === "entering"
          ? { phase: "open" as const, mounted: true, dataState: "open" as const }
          : state,
      AnimationEnd: () =>
        state.phase === "exiting"
          ? { phase: "unmounted" as const, mounted: false, dataState: "closed" as const }
          : state
    })
  )
