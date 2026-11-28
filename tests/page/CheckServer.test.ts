import { Html } from "@effect/ui/html"
import { describe, expect, it } from "bun:test"
import { Effect, Exit, Schema } from "effect"
import { GlobalWindow } from "happy-dom"
import { auditServer, checkServer } from "../../src/page/index.js"

const CleanComponent = Html.component({
  name: "CleanComponent",
  props: Schema.Struct({ greeting: Schema.String }),
  model: Schema.String,
  message: Schema.Never
}).make({
  init: ($) => $.props.greeting,
  update: ($) => $.model,
  view: (h, model) => h.main(h.h1(model))
})

const ReadsWindow = Html.component({
  name: "ReadsWindow",
  model: Schema.String,
  message: Schema.Never
}).make({
  init: () => (typeof window !== "undefined" ? "browser" : "server"),
  update: ($) => $.model,
  view: (h, model) => h.div(model)
})

const ReadsDocument = Html.component({
  name: "ReadsDocument",
  model: Schema.String,
  message: Schema.Never
}).make({
  init: () => "ok",
  update: ($) => $.model,
  view: (h) => h.div(typeof document !== "undefined" ? "dom" : "ssr")
})

const ReadsLocalStorage = Html.component({
  name: "ReadsLocalStorage",
  model: Schema.String,
  message: Schema.Never
}).make({
  init: () => (typeof localStorage !== "undefined" ? "ls" : "none"),
  update: ($) => $.model,
  view: (h, model) => h.div(model)
})

const ReadsDateNow = Html.component({
  name: "ReadsDateNow",
  model: Schema.String,
  message: Schema.Never
}).make({
  init: () => String(Date.now()),
  update: ($) => $.model,
  view: (h, ts) => h.time(ts)
})

const ReadsMathRandom = Html.component({
  name: "ReadsMathRandom",
  model: Schema.String,
  message: Schema.Never
}).make({
  init: () => "0",
  update: ($) => $.model,
  view: (h) => h.span(String(Math.random()))
})

const ReadsRandomUUID = Html.component({
  name: "ReadsRandomUUID",
  model: Schema.String,
  message: Schema.Never
}).make({
  init: () => crypto.randomUUID(),
  update: ($) => $.model,
  view: (h, id) => h.div(id)
})

const MultiImpure = Html.component({
  name: "MultiImpure",
  model: Schema.String,
  message: Schema.Never
}).make({
  init: () => `${typeof window}:${Date.now()}`,
  update: ($) => $.model,
  view: (h, model) => h.div(`${model}:${Math.random()}`)
})

describe("checkServer SSR purity guard (clean baseline + 6 planted SSR faults)", () => {
  it("passes clean component and restores pre-existing happy-dom globals untouched", () =>
    Effect.runPromise(
      Effect.gen(function*() {
        const win = new GlobalWindow({ url: "http://localhost/" })
        const origWindowDesc = Object.getOwnPropertyDescriptor(globalThis, "window")
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          writable: true,
          value: win
        })
        try {
          const rendered = yield* checkServer(CleanComponent, { greeting: "Hello SSR" })
          expect(rendered.html).toContain("Hello SSR")
          // Global window is restored after checkServer finishes
          expect<unknown>(globalThis.window).toBe(win)
        } finally {
          yield* Effect.promise(() => win.happyDOM.close())
          if (origWindowDesc === undefined) {
            Reflect.deleteProperty(globalThis, "window")
          } else {
            Object.defineProperty(globalThis, "window", origWindowDesc)
          }
        }
      })
    ))

  it("catches each planted SSR impurity by its exact kind and symbol", () =>
    Effect.runPromise(
      Effect.gen(function*() {
        const cases = [
          [ReadsWindow, "browser-global", "window"],
          [ReadsDocument, "browser-global", "document"],
          [ReadsLocalStorage, "browser-global", "localStorage"],
          [ReadsDateNow, "clock", "Date.now"],
          [ReadsMathRandom, "random", "Math.random"],
          [ReadsRandomUUID, "random", "crypto.randomUUID"]
        ] as const

        for (const [comp, expectedKind, expectedSymbol] of cases) {
          const { violations } = yield* auditServer(comp, {})
          expect(violations.some((v) => v.kind === expectedKind && v.symbol === expectedSymbol)).toBe(true)
        }
      })
    ))

  it("collects all simultaneous SSR purity violations into one ServerPurityError", () =>
    Effect.runPromise(
      Effect.gen(function*() {
        const exit = yield* Effect.exit(checkServer(MultiImpure, {}))
        expect(Exit.isFailure(exit)).toBe(true)
        if (Exit.isFailure(exit)) {
          const reason = exit.cause.reasons[0]
          expect(reason?._tag).toBe("Fail")
          if (reason?._tag === "Fail") {
            const symbols = reason.error.violations.map((v) => v.symbol)
            expect(symbols).toContain("window")
            expect(symbols).toContain("Date.now")
            expect(symbols).toContain("Math.random")
            expect(reason.error.violations.length).toBe(3)
          }
        }
      })
    ))
})
