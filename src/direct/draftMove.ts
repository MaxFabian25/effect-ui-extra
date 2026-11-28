export type DraftMoveSource = "pointer" | "keyboard"

export interface DraftMoveState<Value> {
  readonly active: boolean
  readonly itemKey: string | null
  readonly source: DraftMoveSource | null
  readonly committed: Value
  readonly draft: Value
}

export interface DraftCommitResult<Value> {
  readonly state: DraftMoveState<Value>
  readonly changed: boolean
  readonly value: Value
  readonly source: DraftMoveSource | null
}

/** Creates an idle draft-move state wrapping the authoritative committed value. */
export const initialDraftMove = <Value>(committed: Value): DraftMoveState<Value> => ({
  active: false,
  itemKey: null,
  source: null,
  committed,
  draft: committed
})

/** Begins a pointer or keyboard drag preview while keeping `committed` intact for cancel rollback. */
export const startDraftMove = <Value>(
  state: DraftMoveState<Value>,
  itemKey: string,
  source: DraftMoveSource
): DraftMoveState<Value> => ({
  active: true,
  itemKey,
  source,
  committed: state.committed,
  draft: state.committed
})

/** Updates the live preview value while a drag or keyboard move is active. */
export const updateDraftMove = <Value>(
  state: DraftMoveState<Value>,
  nextDraft: Value
): DraftMoveState<Value> => (state.active ? { ...state, draft: nextDraft } : state)

/** Commits the preview draft as the new authoritative value and ends the move session. */
export const commitDraftMove = <Value>(
  state: DraftMoveState<Value>,
  equals: (a: Value, b: Value) => boolean = Object.is
): DraftCommitResult<Value> => {
  if (!state.active) {
    return { state, changed: false, value: state.committed, source: null }
  }
  const changed = !equals(state.committed, state.draft)
  const source = state.source
  return {
    state: {
      active: false,
      itemKey: null,
      source: null,
      committed: state.draft,
      draft: state.draft
    },
    changed,
    value: state.draft,
    source
  }
}

/** Cancels an active drag preview and restores `draft` back to `committed`. */
export const cancelDraftMove = <Value>(
  state: DraftMoveState<Value>
): DraftMoveState<Value> => ({
  active: false,
  itemKey: null,
  source: null,
  committed: state.committed,
  draft: state.committed
})

/** Syncs external prop updates into `committed` (and `draft` when no move is active). */
export const syncDraftMoveCommitted = <Value>(
  state: DraftMoveState<Value>,
  committed: Value
): DraftMoveState<Value> =>
  state.active
    ? { ...state, committed }
    : { ...state, committed, draft: committed }
