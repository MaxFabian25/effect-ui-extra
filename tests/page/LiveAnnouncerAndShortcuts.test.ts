import { HtmlLocator, HtmlPlay } from "@effect/ui/html/testing"
import { Locator, TestHost } from "@effect/ui/testing"
import { describe, expect, it } from "bun:test"
import { Effect, Layer } from "effect"
import { TestClock } from "effect/testing"
import {
  ariaKeyshortcuts,
  createShortcutTable,
  formatShortcut,
  LiveAnnouncer,
  liveAnnouncerLayer,
  LiveRegion,
  ShortcutRegistry,
  shortcutRegistryLayer
} from "../../src/page/index.js"

describe("LiveAnnouncer and LiveRegion", () => {
  it("announces polite and assertive messages, swaps slots on repeated identical text, and records history", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(LiveRegion, {})
          const announcer = yield* LiveAnnouncer

          yield* announcer.announce("Saved draft")
          yield* TestHost.settle
          const statusNodes1 = play.root.all(HtmlLocator.role("status"))
          expect(statusNodes1.length).toBe(2)
          const texts1 = statusNodes1.map((n) => Locator.textOf(n))
          expect(texts1).toEqual(["", "Saved draft"])

          // Repeating the exact same message moves it to the alternate slot so SR re-announces it
          yield* announcer.announce("Saved draft")
          yield* TestHost.settle
          const texts2 = play.root
            .all(HtmlLocator.role("status"))
            .map((n) => Locator.textOf(n))
          expect(texts2).toEqual(["Saved draft", ""])

          // Assertive message goes to role="alert"
          yield* announcer.announce("Connection lost", "assertive")
          yield* TestHost.settle
          const alertTexts = play.root
            .all(HtmlLocator.role("alert"))
            .map((n) => Locator.textOf(n))
          expect(alertTexts).toEqual(["", "Connection lost"])

          // Whitespace-only message is ignored
          yield* announcer.announce("   ")
          const history = yield* announcer.history
          expect(history.map((a) => [a.politeness, a.message])).toEqual([
            ["polite", "Saved draft"],
            ["polite", "Saved draft"],
            ["assertive", "Connection lost"]
          ])

          // Clear empties all live slots
          yield* announcer.clear
          yield* TestHost.settle
          expect(
            play.root.all(HtmlLocator.role("status")).map((n) => Locator.textOf(n))
          ).toEqual(["", ""])
          expect(
            play.root.all(HtmlLocator.role("alert")).map((n) => Locator.textOf(n))
          ).toEqual(["", ""])
        })
      ).pipe(
        Effect.provide(
          Layer.mergeAll(TestHost.layer(), TestClock.layer(), liveAnnouncerLayer())
        )
      )
    ))
})

describe("Shortcut discovery, formatting, aria-keyshortcuts, and conflict detection", () => {
  it("formats single keys, modifiers, and sequences for mac and non-mac platforms", () => {
    expect(formatShortcut({ mod: true, key: "k" }, "mac")).toBe("⌘K")
    expect(formatShortcut({ mod: true, key: "k" }, "other")).toBe("Ctrl+K")
    expect(formatShortcut({ mod: true, shift: true, key: "Enter" }, "mac")).toBe("⇧⌘↵")
    expect(formatShortcut({ mod: true, shift: true, key: "Enter" }, "other")).toBe("Ctrl+Shift+Enter")
    expect(formatShortcut({ keys: ["g", "d"] }, "mac")).toBe("G then D")
  })

  it("generates standard WAI-ARIA aria-keyshortcuts strings", () => {
    expect(ariaKeyshortcuts({ mod: true, key: "k" })).toBe("Control+K Meta+K")
    expect(ariaKeyshortcuts({ shift: true, key: "?" })).toBe("Shift+?")
    expect(ariaKeyshortcuts({ keys: ["g", "d"] })).toBe("G D")
    expect(ariaKeyshortcuts({ ctrl: true, key: " " })).toBe("Control+Space")
  })

  it("registers shortcuts per Scope, detects same-scope conflicts, and shares one source of truth with HtmlKeyboard", () =>
    Effect.runPromise(
      Effect.gen(function*() {
        const registry = yield* ShortcutRegistry
        const table = createShortcutTable([
          { id: "palette", label: "Open command palette", mod: true, key: "k", message: "OPEN" as const },
          { id: "save", label: "Save document", mod: true, key: "s", message: "SAVE" as const }
        ])

        // Handler matches Ctrl+K
        expect(
          table.handler({
            key: "k",
            ctrl: true,
            meta: false,
            alt: false,
            shift: false,
            composing: false,
            repeat: false,
            editable: false,
            selectionStart: null,
            selectionEnd: null
          })
        ).toBe("OPEN")

        yield* Effect.scoped(
          Effect.gen(function*() {
            for (const entry of table.metadata) {
              yield* registry.register(entry)
            }
            expect((yield* registry.list).length).toBe(2)
            expect(yield* registry.conflicts).toEqual([])

            // Register a conflicting binding in the same scope
            yield* registry.register({
              id: "search",
              label: "Duplicate search",
              mod: true,
              key: "K"
            })
            const conflicts = yield* registry.conflicts
            expect(conflicts.length).toBe(1)
            expect(conflicts[0]?.ids).toEqual(["palette", "search"])
          })
        )

        // Closing the Scope unregisters every shortcut automatically
        expect(yield* registry.list).toEqual([])
      }).pipe(Effect.provide(shortcutRegistryLayer()))
    ))
})
