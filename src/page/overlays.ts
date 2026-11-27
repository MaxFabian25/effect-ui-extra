import { Command, Subscription, UiSchema } from "@effect/ui"
import { AlertDialog, Dialog } from "@effect/ui-kit"
import { Html } from "@effect/ui/html"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

export interface ConfirmOptions {
  readonly title: string
  readonly description: string
  readonly confirmLabel?: string | undefined
  readonly cancelLabel?: string | undefined
  readonly destructive?: boolean | undefined
}

export interface PromptOptions {
  readonly title: string
  readonly description?: string | undefined
  readonly label: string
  readonly defaultValue?: string | undefined
  readonly placeholder?: string | undefined
  readonly confirmLabel?: string | undefined
  readonly cancelLabel?: string | undefined
}

export const ConfirmOverlayEntry = Schema.Struct({
  _tag: Schema.Literal("Confirm"),
  id: Schema.String,
  title: Schema.String,
  description: Schema.String,
  confirmLabel: Schema.String,
  cancelLabel: Schema.String,
  destructive: Schema.Boolean
})

export const PromptOverlayEntry = Schema.Struct({
  _tag: Schema.Literal("Prompt"),
  id: Schema.String,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  label: Schema.String,
  defaultValue: Schema.String,
  placeholder: Schema.NullOr(Schema.String),
  confirmLabel: Schema.String,
  cancelLabel: Schema.String
})

export const OverlayEntry = Schema.Union([ConfirmOverlayEntry, PromptOverlayEntry])
export type OverlayEntry = typeof OverlayEntry.Type

export type OverlayResult =
  | { readonly _tag: "Confirmed"; readonly accepted: boolean }
  | { readonly _tag: "Prompted"; readonly value: string | null }

export interface OverlaysService {
  /**
   * Opens a confirmation `AlertDialog` in `OverlayHost` and suspends until the
   * user confirms (`true`), cancels (`false`), or dismisses. Automatically
   * removes itself from the queue if the awaiting fiber is interrupted.
   */
  readonly confirm: (options: ConfirmOptions) => Effect.Effect<boolean>
  /**
   * Opens a prompt `Dialog` in `OverlayHost` and suspends until the user
   * submits a string or cancels (`null`). Automatically cleans up on
   * interruption.
   */
  readonly prompt: (options: PromptOptions) => Effect.Effect<string | null>
  /** Current queued overlay entries (first entry is active). */
  readonly queue: Effect.Effect<ReadonlyArray<OverlayEntry>>
  /** Stream of queue snapshots for `OverlayHost`. */
  readonly changes: Stream.Stream<ReadonlyArray<OverlayEntry>>
  /** Resolves an active overlay by ID and removes it from the queue. */
  readonly resolve: (id: string, result: OverlayResult) => Effect.Effect<void>
  /** Dismisses an overlay by ID with its cancellation value (`false` or `null`). */
  readonly dismiss: (id: string) => Effect.Effect<void>
}

export class Overlays extends Context.Service<
  Overlays,
  OverlaysService
>()("effect-ui-page/Overlays") {}

interface InternalItem {
  readonly entry: OverlayEntry
  readonly complete: (result: OverlayResult) => Effect.Effect<void>
  readonly cancel: Effect.Effect<void>
}

export const makeOverlays = (): Effect.Effect<OverlaysService> =>
  Effect.gen(function*() {
    let seq = 0
    let items: Array<InternalItem> = []
    const pubsub = yield* PubSub.unbounded<ReadonlyArray<OverlayEntry>>()

    const snapshot = (): ReadonlyArray<OverlayEntry> =>
      items.map((item) => item.entry)

    const notify = () => PubSub.publish(pubsub, snapshot())

    const removeById = (id: string): InternalItem | undefined => {
      const idx = items.findIndex((i) => i.entry.id === id)
      if (idx === -1) return undefined
      const [removed] = items.splice(idx, 1)
      return removed
    }

    const enqueue = <A>(
      entry: OverlayEntry,
      deferred: Deferred.Deferred<A>,
      decode: (result: OverlayResult) => A,
      cancelValue: A
    ): Effect.Effect<A> =>
      Effect.gen(function*() {
        const item: InternalItem = {
          entry,
          complete: (result) => Deferred.succeed(deferred, decode(result)).pipe(Effect.asVoid),
          cancel: Deferred.succeed(deferred, cancelValue).pipe(Effect.asVoid)
        }
        items.push(item)
        yield* notify()
        return yield* Deferred.await(deferred).pipe(
          Effect.onInterrupt(() =>
            Effect.gen(function*() {
              const removed = removeById(entry.id)
              if (removed !== undefined) {
                yield* notify()
              }
            })
          )
        )
      })

    const confirm = (options: ConfirmOptions): Effect.Effect<boolean> =>
      Effect.gen(function*() {
        const id = `overlay-${++seq}`
        const deferred = yield* Deferred.make<boolean>()
        const entry: OverlayEntry = {
          _tag: "Confirm",
          id,
          title: options.title,
          description: options.description,
          confirmLabel: options.confirmLabel ?? "Confirm",
          cancelLabel: options.cancelLabel ?? "Cancel",
          destructive: options.destructive ?? false
        }
        return yield* enqueue(
          entry,
          deferred,
          (res) => (res._tag === "Confirmed" ? res.accepted : false),
          false
        )
      })

    const prompt = (options: PromptOptions): Effect.Effect<string | null> =>
      Effect.gen(function*() {
        const id = `overlay-${++seq}`
        const deferred = yield* Deferred.make<string | null>()
        const entry: OverlayEntry = {
          _tag: "Prompt",
          id,
          title: options.title,
          description: options.description ?? null,
          label: options.label,
          defaultValue: options.defaultValue ?? "",
          placeholder: options.placeholder ?? null,
          confirmLabel: options.confirmLabel ?? "Submit",
          cancelLabel: options.cancelLabel ?? "Cancel"
        }
        return yield* enqueue(
          entry,
          deferred,
          (res) => (res._tag === "Prompted" ? res.value : null),
          null
        )
      })

    const resolve = (id: string, result: OverlayResult): Effect.Effect<void> =>
      Effect.gen(function*() {
        const removed = removeById(id)
        if (removed === undefined) return
        yield* removed.complete(result)
        yield* notify()
      })

    const dismiss = (id: string): Effect.Effect<void> =>
      Effect.gen(function*() {
        const removed = removeById(id)
        if (removed === undefined) return
        yield* removed.cancel
        yield* notify()
      })

    return {
      confirm,
      prompt,
      queue: Effect.sync(snapshot),
      changes: Stream.fromPubSub(pubsub),
      resolve,
      dismiss
    }
  })

export class ResolveOverlay extends Command.Service<ResolveOverlay>()(
  "effect-ui-page/ResolveOverlay",
  {
    args: {
      id: Schema.String,
      kind: Schema.Literals(["confirm", "prompt", "dismiss"]),
      accepted: Schema.optional(Schema.Boolean),
      value: Schema.optional(Schema.NullOr(Schema.String))
    },
    success: Schema.Void
  }
) {
  static readonly layer: Layer.Layer<ResolveOverlay, never, Overlays> =
    this.toLayer(
      Effect.gen(function*() {
        const overlays = yield* Overlays
        return ({ accepted, id, kind, value }) => {
          if (kind === "confirm") {
            return overlays.resolve(id, {
              _tag: "Confirmed",
              accepted: accepted ?? false
            })
          }
          if (kind === "prompt") {
            return overlays.resolve(id, {
              _tag: "Prompted",
              value: value ?? null
            })
          }
          return overlays.dismiss(id)
        }
      })
    )
}

export const overlaysLayer = (): Layer.Layer<Overlays | ResolveOverlay> =>
  ResolveOverlay.layer.pipe(
    Layer.provideMerge(Layer.effect(Overlays, makeOverlays()))
  )

// ---------------------------------------------------------------------------
// OverlayHost (@effect/ui component built on @effect/ui-kit AlertDialog & Dialog)
// ---------------------------------------------------------------------------

const HostMsg = UiSchema.TaggedEnum({
  QueueUpdated: { entries: Schema.Array(OverlayEntry) },
  ChangedDraft: { value: Schema.String },
  AcceptedConfirm: { id: Schema.String },
  Cancelled: { id: Schema.String },
  SubmittedPrompt: { id: Schema.String },
  Resolved: {}
})

const HostModel = Schema.Struct({
  entries: Schema.Array(OverlayEntry),
  draft: Schema.String,
  draftForId: Schema.NullOr(Schema.String)
})

/**
 * Mount once near your app root to render `Overlays.confirm` (as an accessible
 * `@effect/ui-kit` `AlertDialog`) and `Overlays.prompt` (as a `Dialog`).
 */
export const OverlayHost = Html.component({
  name: "OverlayHost",
  model: HostModel,
  message: HostMsg
}).make({
  init: () => ({ entries: [], draft: "", draftForId: null }),
  subscriptions: () => [
    Subscription.make(
      "effect-ui-page/overlays-queue",
      Stream.unwrap(
        Overlays.use((overlays) =>
          Effect.map(overlays.queue, (initial) =>
            Stream.concat(Stream.make(initial), overlays.changes).pipe(
              Stream.map((entries) => HostMsg.QueueUpdated({ entries: [...entries] }))
            )
          )
        )
      )
    )
  ],
  update: {
    QueueUpdated: ($, { entries }) => {
      const active = entries[0]
      if (active === undefined) {
        return $.set({ entries, draft: "", draftForId: null })
      }
      if (active._tag === "Prompt" && $.model.draftForId !== active.id) {
        return $.set({
          entries,
          draft: active.defaultValue,
          draftForId: active.id
        })
      }
      return $.evolve({ entries })
    },
    ChangedDraft: ($, { value }) => $.evolve({ draft: value }),
    AcceptedConfirm: ($, { id }) =>
      $.run(
        Command.map(
          ResolveOverlay.make({ id, kind: "confirm", accepted: true }),
          () => HostMsg.Resolved()
        )
      ),
    SubmittedPrompt: ($, { id }) =>
      $.run(
        Command.map(
          ResolveOverlay.make({ id, kind: "prompt", value: $.model.draft }),
          () => HostMsg.Resolved()
        )
      ),
    Cancelled: ($, { id }) =>
      $.run(
        Command.map(
          ResolveOverlay.make({ id, kind: "dismiss" }),
          () => HostMsg.Resolved()
        )
      ),
    Resolved: ($) => $.model
  },
  view: (h, model) => {
    const active = model.entries[0]
    if (active === undefined) return h.div.attrs({ "data-overlay-host": "" })

    if (active._tag === "Confirm") {
      return h.div.attrs({ "data-overlay-host": "" }).children(
        AlertDialog(h, {
          key: active.id,
          props: { open: true },
          onEmit: {
            RequestedOpen: () => undefined,
            RequestedClose: () => HostMsg.Cancelled({ id: active.id }),
            Settled: () => undefined
          },
          view: (d) =>
            h.div(
              d.portal(h.dialog)?.children(
                d.backdrop(h.div.attrs({ "data-overlay-backdrop": "" })),
                d.viewport(h.div.attrs({ "data-overlay-viewport": "" })).children(
                  d.popup(
                    h.div.attrs({
                      "data-overlay-popup": "",
                      ...(active.destructive ? { "data-destructive": "" } : {})
                    })
                  ).children(
                    d.title(h.h2).children(active.title),
                    d.description(h.p).children(active.description),
                    h.div.attrs({ "data-overlay-actions": "" }).children(
                      d.initialFocus(d.close(h.button)).children(active.cancelLabel),
                      h.button
                        .attrs({
                          type: "button",
                          "data-overlay-confirm": "",
                          ...(active.destructive ? { "data-variant": "destructive" } : {})
                        })
                        .on("click", HostMsg.AcceptedConfirm({ id: active.id }))
                        .children(active.confirmLabel)
                    )
                  )
                )
              )
            )
        })
      )
    }

    const inputId = `${active.id}-input`
    return h.div.attrs({ "data-overlay-host": "" }).children(
      Dialog(h, {
        key: active.id,
        props: { open: true },
        onEmit: {
          RequestedOpen: () => undefined,
          RequestedClose: () => HostMsg.Cancelled({ id: active.id }),
          Settled: () => undefined
        },
        view: (d) =>
          h.div(
            d.portal(h.dialog)?.children(
              d.backdrop(h.div.attrs({ "data-overlay-backdrop": "" })),
              d.viewport(h.div.attrs({ "data-overlay-viewport": "" })).children(
                d.popup(h.div.attrs({ "data-overlay-popup": "" })).children(
                  d.title(h.h2).children(active.title),
                  active.description !== null
                    ? d.description(h.p).children(active.description)
                    : undefined,
                  h.form
                    .on("submit", HostMsg.SubmittedPrompt({ id: active.id }))
                    .children(
                      h.label.attrs({ for: inputId }).children(active.label),
                      d.initialFocus(
                        h.input
                          .attrs({
                            id: inputId,
                            type: "text",
                            ...(active.placeholder !== null
                              ? { placeholder: active.placeholder }
                              : {})
                          })
                          .value(model.draft)
                          .on("input", ({ value }) =>
                            HostMsg.ChangedDraft({ value })
                          )
                      ),
                      h.div.attrs({ "data-overlay-actions": "" }).children(
                        d.close(h.button).children(active.cancelLabel),
                        h.button
                          .attrs({ type: "submit", "data-overlay-confirm": "" })
                          .children(active.confirmLabel)
                      )
                    )
                )
              )
            )
          )
      })
    )
  }
})
