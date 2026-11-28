import { Subscription, UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Match from "effect/Match"
import * as PubSub from "effect/PubSub"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

export const Politeness = Schema.Literals(["polite", "assertive"])
export type Politeness = typeof Politeness.Type

export const Announcement = Schema.Struct({
  id: Schema.Finite,
  message: Schema.String,
  politeness: Politeness
})
export type Announcement = typeof Announcement.Type

type LiveAnnouncerEvent =
  | { readonly _tag: "Announce"; readonly announcement: Announcement }
  | { readonly _tag: "Clear" }

const LiveAnnouncerEvent = Data.taggedEnum<LiveAnnouncerEvent>()

export interface LiveAnnouncerService {
  /** Announces a screen-reader message with `"polite"` (default) or `"assertive"` priority. */
  readonly announce: (
    message: string,
    politeness?: Politeness
  ) => Effect.Effect<void>
  /** Clears both live regions. */
  readonly clear: Effect.Effect<void>
  /** Every announcement made so far (for `TestHost` assertions). */
  readonly history: Effect.Effect<ReadonlyArray<Announcement>>
  /** Stream of live announcements and clear events. */
  readonly events: Stream.Stream<
    { readonly _tag: "Announce"; readonly announcement: Announcement }
    | { readonly _tag: "Clear" }
  >
}

export class LiveAnnouncer extends Context.Service<
  LiveAnnouncer,
  LiveAnnouncerService
>()("effect-ui-page/LiveAnnouncer") {}

export const makeLiveAnnouncer: Effect.Effect<LiveAnnouncerService> =
  Effect.gen(function*() {
    let seq = 0
    const log: Array<Announcement> = []
    const pubsub = yield* PubSub.unbounded<LiveAnnouncerEvent>()

    const announce = (
      message: string,
      politeness: Politeness = "polite"
    ): Effect.Effect<void> =>
      Effect.gen(function*() {
        const trimmed = message.trim()
        if (trimmed.length === 0) return
        const announcement: Announcement = {
          id: ++seq,
          message: trimmed,
          politeness
        }
        log.push(announcement)
        yield* PubSub.publish(pubsub, LiveAnnouncerEvent.Announce({ announcement }))
      })

    const clear: Effect.Effect<void> = PubSub.publish(pubsub, LiveAnnouncerEvent.Clear()).pipe(
      Effect.asVoid
    )

    return {
      announce,
      clear,
      history: Effect.sync(() => [...log]),
      events: Stream.fromPubSub(pubsub)
    }
  })

export const liveAnnouncerLayer: Layer.Layer<LiveAnnouncer> =
  Layer.effect(LiveAnnouncer, makeLiveAnnouncer)

// ---------------------------------------------------------------------------
// LiveRegion component (visually hidden polite + assertive slots)
// ---------------------------------------------------------------------------

const LiveMsg = UiSchema.TaggedEnum({
  Received: { announcement: Announcement },
  Cleared: {}
})

const LiveModel = Schema.Struct({
  politeA: Schema.String,
  politeB: Schema.String,
  politeSlot: Schema.Literals(["a", "b"]),
  assertiveA: Schema.String,
  assertiveB: Schema.String,
  assertiveSlot: Schema.Literals(["a", "b"])
})

const srOnlyStyle =
  "position:fixed;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0"

/**
 * Mount once near your app root. Uses alternating dual slots per politeness
 * level so repeating the exact same message still fires a screen-reader
 * announcement.
 */
export const LiveRegion = Html.component({
  name: "LiveRegion",
  model: LiveModel,
  message: LiveMsg
}).make({
  init: () => ({
    politeA: "",
    politeB: "",
    politeSlot: "a" as const,
    assertiveA: "",
    assertiveB: "",
    assertiveSlot: "a" as const
  }),
  subscriptions: () => [
    Subscription.make(
      "effect-ui-page/live-announcer",
      Stream.unwrap(
        LiveAnnouncer.use((announcer) =>
          Effect.succeed(
            announcer.events.pipe(
              Stream.map(
                Match.type<LiveAnnouncerEvent>().pipe(
                  Match.tagsExhaustive({
                    Clear: () => LiveMsg.Cleared(),
                    Announce: ({ announcement }) => LiveMsg.Received({ announcement })
                  })
                )
              )
            )
          )
        )
      )
    )
  ],
  update: {
    Received: ($, { announcement }) => {
      if (announcement.politeness === "assertive") {
        const nextSlot = $.model.assertiveSlot === "a" ? ("b" as const) : ("a" as const)
        return $.evolve({
          assertiveSlot: nextSlot,
          assertiveA: nextSlot === "a" ? announcement.message : "",
          assertiveB: nextSlot === "b" ? announcement.message : ""
        })
      }
      const nextSlot = $.model.politeSlot === "a" ? ("b" as const) : ("a" as const)
      return $.evolve({
        politeSlot: nextSlot,
        politeA: nextSlot === "a" ? announcement.message : "",
        politeB: nextSlot === "b" ? announcement.message : ""
      })
    },
    Cleared: () => ({
      politeA: "",
      politeB: "",
      politeSlot: "a" as const,
      assertiveA: "",
      assertiveB: "",
      assertiveSlot: "a" as const
    })
  },
  view: (h, model) =>
    h.div.attrs({ "data-live-region": "", style: srOnlyStyle }).children(
      h.div
        .attrs({ role: "status", "aria-live": "polite", "aria-atomic": "true" })
        .children(model.politeA),
      h.div
        .attrs({ role: "status", "aria-live": "polite", "aria-atomic": "true" })
        .children(model.politeB),
      h.div
        .attrs({ role: "alert", "aria-live": "assertive", "aria-atomic": "true" })
        .children(model.assertiveA),
      h.div
        .attrs({ role: "alert", "aria-live": "assertive", "aria-atomic": "true" })
        .children(model.assertiveB)
    )
})
