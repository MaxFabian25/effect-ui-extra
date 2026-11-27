export interface TouchPoint {
  readonly x: number
  readonly y: number
}

export interface IosTouchGuardConfig {
  /**
   * Maximum finger drift (in CSS pixels) still classified as a wobbling tap
   * rather than an intentional scroll gesture. Defaults to `10`.
   */
  readonly jitterTolerancePx?: number | undefined
  /**
   * Window in milliseconds during which a native browser click after a
   * synthesized tap click is ignored to prevent double activation. Defaults to `400`.
   */
  readonly dedupeWindowMs?: number | undefined
}

export interface IosTouchGuardState {
  readonly active: boolean
  readonly start: TouchPoint | null
  readonly wobblingTap: boolean
  readonly moved: boolean
  readonly lastSyntheticClickMs: number | null
}

export type IosTouchGuardEvent =
  | { readonly _tag: "TouchStart"; readonly point: TouchPoint; readonly insideModal: boolean }
  | { readonly _tag: "TouchMove"; readonly point: TouchPoint }
  | { readonly _tag: "TouchEnd"; readonly nowMs: number; readonly insideModal: boolean }
  | { readonly _tag: "TouchCancel" }

export interface IosTouchGuardDecision {
  readonly state: IosTouchGuardState
  /** Prevent default on `touchmove` to block iOS background scroll bleed. */
  readonly preventDefault: boolean
  /** Dispatch a single click on the resolved interactive target. */
  readonly synthesizeClick: boolean
}

export const initialIosTouchGuardState: IosTouchGuardState = {
  active: false,
  start: null,
  wobblingTap: false,
  moved: false,
  lastSyntheticClickMs: null
}

/**
 * Pure state machine implementing the iOS modal touch jitter guard
 * (paralleling `vercel-labs/ui#1463`): keeps preventing the first `touchmove`
 * scroll-bleed under modal scroll locks while letting a slightly wobbling tap
 * activate buttons and icons once, even under nested modals.
 */
export const reduceIosTouchGuard = (
  state: IosTouchGuardState,
  event: IosTouchGuardEvent,
  config: IosTouchGuardConfig = {}
): IosTouchGuardDecision => {
  const tolerance = Math.max(0, config.jitterTolerancePx ?? 10)
  const dedupeMs = Math.max(0, config.dedupeWindowMs ?? 400)

  switch (event._tag) {
    case "TouchStart": {
      if (!event.insideModal) {
        return {
          state: { ...state, active: false, start: null, wobblingTap: false, moved: false },
          preventDefault: false,
          synthesizeClick: false
        }
      }
      return {
        state: {
          ...state,
          active: true,
          start: event.point,
          wobblingTap: true,
          moved: false
        },
        preventDefault: false,
        synthesizeClick: false
      }
    }
    case "TouchMove": {
      if (!state.active || state.start === null) {
        return { state, preventDefault: false, synthesizeClick: false }
      }
      const dx = event.point.x - state.start.x
      const dy = event.point.y - state.start.y
      const dist = Math.hypot(dx, dy)
      if (dist <= tolerance) {
        return {
          state: { ...state, moved: true, wobblingTap: true },
          preventDefault: true,
          synthesizeClick: false
        }
      }
      return {
        state: { ...state, moved: true, wobblingTap: false },
        preventDefault: false,
        synthesizeClick: false
      }
    }
    case "TouchEnd": {
      if (!state.active) {
        return { state, preventDefault: false, synthesizeClick: false }
      }
      const withinDedupe =
        state.lastSyntheticClickMs !== null &&
        event.nowMs - state.lastSyntheticClickMs < dedupeMs
      const shouldClick =
        event.insideModal && state.wobblingTap && state.moved && !withinDedupe
      return {
        state: {
          active: false,
          start: null,
          wobblingTap: false,
          moved: false,
          lastSyntheticClickMs: shouldClick ? event.nowMs : state.lastSyntheticClickMs
        },
        preventDefault: false,
        synthesizeClick: shouldClick
      }
    }
    case "TouchCancel":
      return {
        state: { ...state, active: false, start: null, wobblingTap: false, moved: false },
        preventDefault: false,
        synthesizeClick: false
      }
  }
}

const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, summary, label, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [tabindex]:not([tabindex="-1"])'

/**
 * Resolves the nearest interactive ancestor within `modalRoot` so taps that
 * land on an `<svg>` icon or `<span>` inside a button activate the button.
 */
export const resolveInteractiveTapTarget = (
  target: EventTarget | null,
  modalRoot: HTMLElement
): HTMLElement | null => {
  if (target === null || typeof Element === "undefined") return null
  const el = target instanceof Element ? target : null
  if (el === null || !modalRoot.contains(el)) return null
  const match = el.closest(INTERACTIVE_SELECTOR)
  if (match === null || !modalRoot.contains(match)) return null
  return match as HTMLElement
}

/**
 * Attaches the iOS modal touch jitter guard to a modal container element.
 * Returns a cleanup function that removes all listeners.
 */
export const bindIosModalTouchGuard = (
  modalRoot: HTMLElement,
  config: IosTouchGuardConfig = {}
): (() => void) => {
  let state = initialIosTouchGuardState
  let startTarget: EventTarget | null = null
  const dedupeMs = Math.max(0, config.dedupeWindowMs ?? 400)

  const onTouchStart = (ev: TouchEvent) => {
    if (ev.touches.length !== 1) {
      state = reduceIosTouchGuard(state, { _tag: "TouchCancel" }, config).state
      startTarget = null
      return
    }
    const t = ev.touches[0]!
    const insideModal = ev.target instanceof Node && modalRoot.contains(ev.target)
    startTarget = ev.target
    state = reduceIosTouchGuard(
      state,
      { _tag: "TouchStart", point: { x: t.clientX, y: t.clientY }, insideModal },
      config
    ).state
  }

  const onTouchMove = (ev: TouchEvent) => {
    if (!state.active || ev.touches.length !== 1) return
    const t = ev.touches[0]!
    const decision = reduceIosTouchGuard(
      state,
      { _tag: "TouchMove", point: { x: t.clientX, y: t.clientY } },
      config
    )
    state = decision.state
    if (decision.preventDefault && ev.cancelable) {
      ev.preventDefault()
    }
  }

  const onTouchEnd = (ev: TouchEvent) => {
    if (!state.active) return
    const insideModal = ev.target instanceof Node && modalRoot.contains(ev.target)
    const decision = reduceIosTouchGuard(
      state,
      { _tag: "TouchEnd", nowMs: Date.now(), insideModal },
      config
    )
    state = decision.state
    const capturedTarget = startTarget
    startTarget = null
    if (decision.synthesizeClick) {
      const clickable = resolveInteractiveTapTarget(capturedTarget, modalRoot)
      if (clickable !== null) {
        clickable.click()
      }
    }
  }

  const onTouchCancel = () => {
    state = reduceIosTouchGuard(state, { _tag: "TouchCancel" }, config).state
    startTarget = null
  }

  const onClickCapture = (ev: MouseEvent) => {
    if (
      ev.isTrusted &&
      state.lastSyntheticClickMs !== null &&
      Date.now() - state.lastSyntheticClickMs < dedupeMs
    ) {
      ev.stopImmediatePropagation()
      ev.preventDefault()
    }
  }

  modalRoot.addEventListener("touchstart", onTouchStart, { passive: true })
  modalRoot.addEventListener("touchmove", onTouchMove, { passive: false })
  modalRoot.addEventListener("touchend", onTouchEnd, { passive: true })
  modalRoot.addEventListener("touchcancel", onTouchCancel, { passive: true })
  modalRoot.addEventListener("click", onClickCapture, { capture: true })

  return () => {
    modalRoot.removeEventListener("touchstart", onTouchStart)
    modalRoot.removeEventListener("touchmove", onTouchMove)
    modalRoot.removeEventListener("touchend", onTouchEnd)
    modalRoot.removeEventListener("touchcancel", onTouchCancel)
    modalRoot.removeEventListener("click", onClickCapture, { capture: true })
  }
}
