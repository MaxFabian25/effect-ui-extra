import { HtmlLocator, HtmlPlay } from "@effect/ui/html/testing"
import { TestHost } from "@effect/ui/testing"
import { describe, expect, it } from "bun:test"
import { Effect, Fiber, Layer } from "effect"
import { TestClock } from "effect/testing"
import { OverlayHost, Overlays, overlaysLayer } from "../../src/page/index.js"

const makeLayer = () =>
  Layer.mergeAll(TestHost.layer(), TestClock.layer(), overlaysLayer)

describe("Deferred-backed Overlays and OverlayHost on TestHost", () => {
  it("Overlays.confirm renders AlertDialog and resolves true on confirm and false on cancel", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(OverlayHost, {})
          const overlays = yield* Overlays

          // Confirm -> true
          const f1 = yield* Effect.forkChild(
            overlays.confirm({
              title: "Delete workspace?",
              description: "All environments will be removed.",
              confirmLabel: "Delete",
              cancelLabel: "Keep",
              destructive: true
            }),
            { startImmediately: true }
          )
          yield* TestHost.settle
          yield* play
            .expect(HtmlLocator.role("alertdialog", { name: "Delete workspace?" }))
            .toExist()
          yield* play
            .expect(HtmlLocator.role("button", { name: "Delete" }))
            .toHaveAttribute("data-variant", "destructive")
          yield* play.click(HtmlLocator.role("button", { name: "Delete" }))
          expect(yield* Fiber.join(f1)).toBe(true)
          yield* play.expect(HtmlLocator.role("alertdialog")).toBeAbsent()

          // Cancel -> false
          const f2 = yield* Effect.forkChild(
            overlays.confirm({
              title: "Reset token?",
              description: "Existing clients will disconnect.",
              confirmLabel: "Reset",
              cancelLabel: "Cancel"
            }),
            { startImmediately: true }
          )
          yield* TestHost.settle
          yield* play
            .expect(HtmlLocator.role("button", { name: "Reset" }))
            .toHaveAttribute("data-variant", "primary")
          yield* play.click(HtmlLocator.role("button", { name: "Cancel" }))
          expect(yield* Fiber.join(f2)).toBe(false)
          yield* play.expect(HtmlLocator.role("alertdialog")).toBeAbsent()
        })
      ).pipe(Effect.provide(makeLayer()))
    ))

  it("Overlays.prompt renders Dialog with labelled input, submits edited text, and returns null on cancel", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(OverlayHost, {})
          const overlays = yield* Overlays

          const f1 = yield* Effect.forkChild(
            overlays.prompt({
              title: "Rename project",
              label: "Project name",
              defaultValue: "Alpha",
              confirmLabel: "Save"
            }),
            { startImmediately: true }
          )
          yield* TestHost.settle
          yield* play
            .expect(HtmlLocator.role("dialog", { name: "Rename project" }))
            .toExist()
          yield* play.type(HtmlLocator.label("Project name"), "Omega")
          yield* play.submit(HtmlLocator.label("Project name"))
          expect(yield* Fiber.join(f1)).toBe("Omega")

          const f2 = yield* Effect.forkChild(
            overlays.prompt({
              title: "Add tag",
              label: "Tag",
              cancelLabel: "Never mind"
            }),
            { startImmediately: true }
          )
          yield* TestHost.settle
          yield* play.click(HtmlLocator.role("button", { name: "Never mind" }))
          expect(yield* Fiber.join(f2)).toBeNull()
        })
      ).pipe(Effect.provide(makeLayer()))
    ))

  it("queues concurrent overlays FIFO and cleans up automatically when an awaiting fiber is interrupted", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(OverlayHost, {})
          const overlays = yield* Overlays

          const first = yield* Effect.forkChild(
            overlays.confirm({
              title: "First confirmation",
              description: "Step one."
            }),
            { startImmediately: true }
          )
          const second = yield* Effect.forkChild(
            overlays.confirm({
              title: "Second confirmation",
              description: "Step two."
            }),
            { startImmediately: true }
          )
          yield* TestHost.settle

          // First is shown
          yield* play
            .expect(HtmlLocator.role("alertdialog", { name: "First confirmation" }))
            .toExist()

          // Interrupt the first fiber -> automatically removes first and advances to second!
          yield* Fiber.interrupt(first)
          yield* TestHost.settle
          yield* play
            .expect(HtmlLocator.role("alertdialog", { name: "Second confirmation" }))
            .toExist()

          yield* play.click(HtmlLocator.role("button", { name: "Confirm" }))
          expect(yield* Fiber.join(second)).toBe(true)
          yield* play.expect(HtmlLocator.role("alertdialog")).toBeAbsent()
        })
      ).pipe(Effect.provide(makeLayer()))
    ))
})
