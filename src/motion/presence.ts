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
): PresenceState => {
  switch (event._tag) {
    case "SetOpen": {
      const skipPhases =
        event.reducedMotion === true && event.reducedMotionMode !== "fade"
      if (event.open) {
        if (state.phase === "open") return state
        if (skipPhases) {
          return { phase: "open", mounted: true, dataState: "open" }
        }
        return { phase: "entering", mounted: true, dataState: "closed" }
      }
      if (state.phase === "unmounted") return state
      if (skipPhases) {
        return { phase: "unmounted", mounted: false, dataState: "closed" }
      }
      return { phase: "exiting", mounted: true, dataState: "closed" }
    }
    case "EnterFrame":
      return state.phase === "entering"
        ? { phase: "open", mounted: true, dataState: "open" }
        : state
    case "AnimationEnd":
      return state.phase === "exiting"
        ? { phase: "unmounted", mounted: false, dataState: "closed" }
        : state
  }
}
