import { describe, expect, test } from "bun:test"
import { Html } from "@effect/ui/html"
import { HtmlPlay } from "@effect/ui/html/testing"
import { TestHost } from "@effect/ui/testing"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Schema from "effect/Schema"
import { auditAccessibleNames, checkAccessibleNames } from "../../src/a11y/index.js"

const CleanToolbar = Html.component({
  name: "CleanToolbar",
  model: Schema.Struct({ on: Schema.Boolean }),
  message: Schema.Struct({})
}).make({
  init: () => ({ on: false }),
  update: () => ({ on: false }),
  view: (h, model) =>
    h.div.children(
      h.button.attrs({ "aria-label": "Close" }).children(
        h.span.attrs({ "aria-hidden": "true" }).children("×")
      ),
      h.label.attrs({ for: "q" }).children("Search"),
      h.input.attrs({ id: "q", type: "text" }),
      h.button
        .attrs({
          role: "switch",
          "aria-checked": String(model.on),
          "aria-labelledby": "sw-lbl"
        }),
      h.span.attrs({ id: "sw-lbl" }).children("Notifications"),
      // Hidden unnamed button must be ignored
      h.div.attrs({ "aria-hidden": "true" }).children(h.button)
    )
})

const BrokenControls = Html.component({
  name: "BrokenControls",
  model: Schema.Struct({}),
  message: Schema.Struct({})
}).make({
  init: () => ({}),
  update: () => ({}),
  view: (h) =>
    h.div.children(
      // Plant 1: icon button with aria-hidden glyph and no aria-label
      h.button.attrs({ id: "icon-btn" }).children(
        h.span.attrs({ "aria-hidden": "true" }).children("×")
      ),
      // Plant 2: unnamed text input
      h.input.attrs({ id: "bare-input", type: "text" }),
      // Plant 3: unnamed switch
      h.div.attrs({ id: "bare-switch", role: "switch", "aria-checked": "false" }),
      // Plant 4: broken aria-labelledby reference
      h.button.attrs({ id: "bad-ref", "aria-labelledby": "does-not-exist" })
    )
})

describe("auditAccessibleNames / checkAccessibleNames", () => {
  test("clean named controls pass with zero violations and ignore aria-hidden subtrees", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(CleanToolbar, {})
          const violations = yield* auditAccessibleNames(play)
          expect(violations).toEqual([])
          yield* checkAccessibleNames(play)
        }).pipe(Effect.provide(TestHost.layer()))
      )
    ))

  test("planted-error check catches 4/4 unnamed or broken-ref interactive controls", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(BrokenControls, {})
          const violations = yield* auditAccessibleNames(play)
          const byElement = violations.map((v) => `${v.rule}:${v.element}`)

          expect(byElement.some((s) => s.includes("missing-accessible-name") && s.includes('id="icon-btn"'))).toBe(true)
          expect(byElement.some((s) => s.includes("missing-accessible-name") && s.includes('id="bare-input"'))).toBe(true)
          expect(byElement.some((s) => s.includes("missing-accessible-name") && s.includes('id="bare-switch"'))).toBe(true)
          expect(byElement.some((s) => s.includes("aria-labelledby-ref") && s.includes('id="bad-ref"'))).toBe(true)

          const exit = yield* Effect.exit(checkAccessibleNames(play))
          expect(Exit.isFailure(exit)).toBe(true)
        }).pipe(Effect.provide(TestHost.layer()))
      )
    ))
})
