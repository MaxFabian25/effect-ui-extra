export interface InputHistoryState<T = string> {
  /** Index into `entries` when recalling, or `null` when editing the live draft. */
  readonly cursor: number | null
  /** Live draft saved before starting recall so `ArrowDown` returns to it. */
  readonly savedDraft: T | undefined
}

export const initialInputHistoryState = <T = string>(): InputHistoryState<T> => ({
  cursor: null,
  savedDraft: undefined
})

export interface InputHistoryStep<T = string> {
  readonly state: InputHistoryState<T>
  readonly value: T | undefined
  readonly handled: boolean
}

/**
 * Steps backward (`ArrowUp`) through `entries` (oldest first), saving the
 * user's unsent `currentValue` on the first recall step.
 */
export const recallHistoryPrevious = <T = string>(
  state: InputHistoryState<T>,
  entries: ReadonlyArray<T>,
  currentValue: T
): InputHistoryStep<T> => {
  if (entries.length === 0) {
    return { state, value: undefined, handled: false }
  }
  if (state.cursor === null) {
    const nextIdx = entries.length - 1
    return {
      state: { cursor: nextIdx, savedDraft: currentValue },
      value: entries[nextIdx]!,
      handled: true
    }
  }
  if (state.cursor <= 0) {
    return { state, value: entries[0], handled: false }
  }
  const nextIdx = state.cursor - 1
  return {
    state: { ...state, cursor: nextIdx },
    value: entries[nextIdx]!,
    handled: true
  }
}

/**
 * Steps forward (`ArrowDown`) through `entries`, restoring `savedDraft` once
 * moving past the newest entry.
 */
export const recallHistoryNext = <T = string>(
  state: InputHistoryState<T>,
  entries: ReadonlyArray<T>
): InputHistoryStep<T> => {
  if (state.cursor === null) {
    return { state, value: undefined, handled: false }
  }
  if (state.cursor >= entries.length - 1) {
    return {
      state: { cursor: null, savedDraft: undefined },
      value: state.savedDraft,
      handled: true
    }
  }
  const nextIdx = state.cursor + 1
  return {
    state: { ...state, cursor: nextIdx },
    value: entries[nextIdx]!,
    handled: true
  }
}

/**
 * Keeps recall anchored to the same entry when new messages arrive in `entries`
 * (using `getKey`), or resets cleanly if the entry is no longer present.
 */
export const syncInputHistory = <T = string>(
  state: InputHistoryState<T>,
  previousEntries: ReadonlyArray<T>,
  nextEntries: ReadonlyArray<T>,
  getKey: (entry: T) => string = (e) => String(e)
): InputHistoryState<T> => {
  if (state.cursor === null) return state
  const prevItem = previousEntries[state.cursor]
  if (prevItem === undefined) return initialInputHistoryState<T>()
  const prevKey = getKey(prevItem)
  const nextIdx = nextEntries.findIndex((e) => getKey(e) === prevKey)
  return nextIdx === -1
    ? initialInputHistoryState<T>()
    : { ...state, cursor: nextIdx }
}
