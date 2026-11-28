export interface ScrollBoundary {
  readonly scrollTop: number
  readonly scrollHeight: number
  readonly clientHeight: number
}

export type ScrollHandoffMode = "idle" | "scroll" | "drag"

export interface ScrollHandoffState {
  readonly mode: ScrollHandoffMode
  readonly dragOffsetPx: number
}

export type ScrollHandoffEdge = "top" | "bottom"

export type ScrollHandoffEvent =
  | { readonly _tag: "PointerDown" }
  | {
      readonly _tag: "PointerDelta"
      /** Signed pointer delta along the vertical axis (+down, -up). */
      readonly deltaY: number
      readonly boundary: ScrollBoundary
      readonly edge?: ScrollHandoffEdge | undefined
    }
  | { readonly _tag: "PointerUp" }
  | { readonly _tag: "PointerCancel" }

export interface ScrollHandoffTransition {
  readonly state: ScrollHandoffState
  /** When `true`, prevent native scroll so the sheet owns pointer movement. */
  readonly preventDefault: boolean
}

export const initialScrollHandoffState: ScrollHandoffState = {
  mode: "idle",
  dragOffsetPx: 0
}

export const isAtScrollTop = (boundary: ScrollBoundary, epsilon = 1): boolean =>
  boundary.scrollTop <= epsilon

export const isAtScrollBottom = (boundary: ScrollBoundary, epsilon = 1): boolean =>
  boundary.scrollTop + boundary.clientHeight >= boundary.scrollHeight - epsilon

/**
 * Pure scroll-to-drag handoff state machine for scrollable bottom sheets and
 * drawers. Allows inner content scrolling while away from the boundary, then
 * smoothly hands off overscroll pulls to sheet dragging without jitter.
 */
export const reduceScrollHandoff = (
  state: ScrollHandoffState,
  event: ScrollHandoffEvent
): ScrollHandoffTransition => {
  switch (event._tag) {
    case "PointerDown":
      return {
        state: { mode: "idle", dragOffsetPx: 0 },
        preventDefault: false
      }
    case "PointerUp":
    case "PointerCancel":
      return {
        state: { mode: "idle", dragOffsetPx: 0 },
        preventDefault: false
      }
    case "PointerDelta": {
      const edge = event.edge ?? "top"
      const pullingIntoDrag =
        edge === "top"
          ? event.deltaY > 0 && isAtScrollTop(event.boundary)
          : event.deltaY < 0 && isAtScrollBottom(event.boundary)

      if (state.mode === "scroll") {
        // Once inner scroll owns the gesture, keep scrolling until the user
        // lifts their finger so accidental reversal does not yank the sheet.
        return { state, preventDefault: false }
      }

      if (state.mode === "drag") {
        const nextRaw = state.dragOffsetPx + event.deltaY
        const crossedBack = edge === "top" ? nextRaw <= 0 : nextRaw >= 0
        if (crossedBack) {
          return {
            state: { mode: "scroll", dragOffsetPx: 0 },
            preventDefault: false
          }
        }
        return {
          state: { mode: "drag", dragOffsetPx: nextRaw },
          preventDefault: true
        }
      }

      // mode === "idle"
      if (event.deltaY === 0) {
        return { state, preventDefault: false }
      }
      if (pullingIntoDrag) {
        return {
          state: { mode: "drag", dragOffsetPx: event.deltaY },
          preventDefault: true
        }
      }
      return {
        state: { mode: "scroll", dragOffsetPx: 0 },
        preventDefault: false
      }
    }
  }
}
