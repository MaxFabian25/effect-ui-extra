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
  | { readonly _tag: "SetOpen"; readonly open: boolean; readonly reducedMotion?: boolean | undefined }
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
 * `"exiting"` phases immediately so zero exit delay occurs when motion is off.
 */
export const reducePresence = (
  state: PresenceState,
  event: PresenceEvent
): PresenceState => {
  switch (event._tag) {
    case "SetOpen": {
      if (event.open) {
        if (state.phase === "open") return state
        if (event.reducedMotion) {
          return { phase: "open", mounted: true, dataState: "open" }
        }
        return { phase: "entering", mounted: true, dataState: "closed" }
      }
      if (state.phase === "unmounted") return state
      if (event.reducedMotion) {
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
