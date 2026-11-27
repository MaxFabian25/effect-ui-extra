export interface ScrollMetrics {
  readonly scrollTop: number
  readonly scrollHeight: number
  readonly clientHeight: number
}

export interface StickToBottomState {
  /** Whether new content should automatically scroll the container to its end. */
  readonly following: boolean
  /** Whether the viewport is currently within `threshold` px of the bottom. */
  readonly atBottom: boolean
  /** Whether new content arrived while not following (clears once at bottom). */
  readonly unseen: boolean
}

export interface StickToBottomTransition {
  readonly state: StickToBottomState
  readonly shouldScrollToBottom: boolean
}

export const initialStickToBottomState = (
  following = true
): StickToBottomState => ({
  following,
  atBottom: following,
  unseen: false
})

export const distanceFromBottom = (metrics: ScrollMetrics): number =>
  Math.max(0, metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop)

export const isAtBottom = (metrics: ScrollMetrics, threshold = 24): boolean =>
  distanceFromBottom(metrics) <= Math.max(0, threshold)

/**
 * Pure update when the user scrolls the container. Scrolling up pauses
 * auto-follow; scrolling back within `threshold` px resumes following and
 * clears `unseen`.
 */
export const onStickScroll = (
  state: StickToBottomState,
  metrics: ScrollMetrics,
  threshold = 24
): StickToBottomState => {
  const atBottom = isAtBottom(metrics, threshold)
  if (atBottom) {
    return { following: true, atBottom: true, unseen: false }
  }
  return {
    following: false,
    atBottom: false,
    unseen: state.unseen
  }
}

/**
 * Pure update when streaming content grows (`scrollHeight` increases).
 * Keeps pinned if `following` is true; otherwise marks `unseen: true`.
 */
export const onStickContentGrowth = (
  state: StickToBottomState,
  metrics: ScrollMetrics,
  threshold = 24
): StickToBottomTransition => {
  if (state.following) {
    return {
      state: { following: true, atBottom: true, unseen: false },
      shouldScrollToBottom: !isAtBottom(metrics, threshold)
    }
  }
  const atBottom = isAtBottom(metrics, threshold)
  return {
    state: {
      following: atBottom,
      atBottom,
      unseen: atBottom ? false : true
    },
    shouldScrollToBottom: false
  }
}

/**
 * Explicit "Jump to latest" action.
 */
export const jumpToBottom = (): StickToBottomTransition => ({
  state: { following: true, atBottom: true, unseen: false },
  shouldScrollToBottom: true
})
