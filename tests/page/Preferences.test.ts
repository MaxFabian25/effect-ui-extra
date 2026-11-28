import { UiSchema } from "@effect/ui"
import { Html, HtmlServer } from "@effect/ui/html"
import { HtmlPlay } from "@effect/ui/html/testing"
import { Locator, TestHost } from "@effect/ui/testing"
import { describe, expect, it } from "bun:test"
import { runInNewContext } from "node:vm"
import { Effect, Layer, Schema } from "effect"
import { TestClock } from "effect/testing"
import { GlobalWindow } from "happy-dom"
import {
  ColorScheme,
  colorSchemeFromHeaders,
  cookieStorageLayer,
  definePreference,
  makeMemoryStorage,
  memoryStorageLayer,
  preferencesScript,
  preferencesScriptBody,
  PreferenceStorage,
  resolveColorScheme
} from "../../src/page/index.js"

const Density = definePreference({
  key: "ui-density",
  attribute: "data-density",
  values: ["comfortable", "compact"] as const,
  defaultValue: "comfortable"
})

const CookieTheme = definePreference({
  key: "theme",
  attribute: "data-theme",
  values: ["light", "dark"] as const,
  defaultValue: "light",
  storageKind: "cookie"
})

describe("Preferences, ColorScheme, and zero-FOUC SSR script", () => {
  it("rejects invalid attribute names, keys, or defaultValue at definition boundary", () => {
    expect(() =>
      definePreference({
        key: "bad",
        attribute: "data-BAD!",
        values: ["a"] as const,
        defaultValue: "a"
      })
    ).toThrow(/Invalid preference attribute/)

    expect(() =>
      definePreference({
        key: "bad key!",
        attribute: "data-ok",
        values: ["a"] as const,
        defaultValue: "a"
      })
    ).toThrow(/Invalid preference key/)

    const values: readonly [string, ...Array<string>] = ["a", "b"]
    expect(() =>
      definePreference({
        key: "ok",
        attribute: "data-ok",
        values,
        defaultValue: "c"
      })
    ).toThrow(/defaultValue/)
  })

  it("restores saved preference, ignores disallowed values, and syncs cross-tab changes in HtmlPlay", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const storage = yield* makeMemoryStorage({ "ui-density": "compact" })
          const Msg = UiSchema.TaggedEnum({
            Changed: { density: Schema.Literals(["comfortable", "compact"]) }
          })
          const App = Html.component({
            name: "PrefApp",
            model: Schema.Literals(["comfortable", "compact"]),
            message: Msg
          }).make({
            init: () => "comfortable" as const,
            subscriptions: () => [
              Density.subscription((density) => Msg.Changed({ density }))
            ],
            head: ({ model }) => [Density.headEntry(model)],
            update: { Changed: (_, { density }) => density },
            view: (h, model) => h.div.attr("data-current", model).children(model)
          })

          const play = yield* HtmlPlay.make(App, {}).pipe(
            Effect.provideService(PreferenceStorage, storage)
          )
          yield* play.expect(Locator.text("compact")).toExist()

          // Simulate another tab switching back to comfortable
          yield* storage.simulateExternalChange("ui-density", "comfortable")
          yield* TestHost.settle
          yield* play.expect(Locator.text("comfortable")).toExist()

          // Corrupted external value falls back to defaultValue
          yield* storage.simulateExternalChange("ui-density", "malicious-value")
          yield* TestHost.settle
          yield* play.expect(Locator.text("comfortable")).toExist()

          // Direct write updates storage and component
          yield* Density.write("compact").pipe(
            Effect.provideService(PreferenceStorage, storage)
          )
          yield* TestHost.settle
          yield* play.expect(Locator.text("compact")).toExist()
          expect(storage.snapshot()["ui-density"]).toBe("compact")
        })
      ).pipe(Effect.provide(Layer.mergeAll(TestHost.layer(), TestClock.layer())))
    ))

  it("reads cookie preferences during SSR and emits htmlData attributes", () =>
    Effect.runPromise(
      Effect.gen(function*() {
        const saved = yield* CookieTheme.read.pipe(
          Effect.provide(cookieStorageLayer("other=1; theme=dark"))
        )
        expect(saved).toBe("dark")

        const corrupted = yield* CookieTheme.read.pipe(
          Effect.provide(cookieStorageLayer("theme=invalid"))
        )
        expect(corrupted).toBe("light")

        const SsrApp = Html.component({
          name: "SsrPrefApp",
          props: Schema.Struct({ theme: Schema.Literals(["light", "dark"]) }),
          model: Schema.Literals(["light", "dark"]),
          message: Schema.Never
        }).make({
          init: ($) => $.props.theme,
          update: ($) => $.model,
          head: ({ model }) => [CookieTheme.headEntry(model)],
          view: (h, model) => h.main(model)
        })

        const rendered = yield* HtmlServer.renderToHtml(SsrApp, { theme: saved })
        expect(rendered.htmlAttributes).toContain('data-theme="dark"')
      }).pipe(Effect.provide(memoryStorageLayer()))
    ))

  it("reads Sec-CH-Prefers-Color-Scheme header and resolves system color scheme", () => {
    expect(colorSchemeFromHeaders({ "Sec-CH-Prefers-Color-Scheme": '"dark"' })).toBe("dark")
    expect(colorSchemeFromHeaders(new Headers({ "sec-ch-prefers-color-scheme": "light" }))).toBe("light")
    expect(colorSchemeFromHeaders({})).toBe("unknown")
    expect(resolveColorScheme("system", "dark")).toBe("dark")
    expect(resolveColorScheme("light", "dark")).toBe("light")
    expect(resolveColorScheme("dark", "unknown")).toBe("dark")
  })

  it("preferencesScript executes cleanly before paint in happy-dom and blocks disallowed/XSS values", async () => {
    const win = new GlobalWindow({ url: "http://localhost/" })
    try {
      win.localStorage.setItem("color-scheme", "dark")
      win.localStorage.setItem("ui-density", '"><script>alert(1)</script>')
      win.document.cookie = "theme=dark; Path=/"

      const meta = win.document.createElement("meta")
      meta.setAttribute("name", "color-scheme")
      meta.setAttribute("content", "light dark")
      win.document.head.appendChild(meta)

      const body = preferencesScriptBody([ColorScheme, Density, CookieTheme])
      runInNewContext(body, { window: win, document: win.document })

      expect(win.document.documentElement.getAttribute("data-color-scheme")).toBe("dark")
      expect(meta.getAttribute("content")).toBe("dark")
      // Disallowed value fell back to defaultValue
      expect(win.document.documentElement.getAttribute("data-density")).toBe("comfortable")
      // Cookie-backed preference restored
      expect(win.document.documentElement.getAttribute("data-theme")).toBe("dark")

      const tag = preferencesScript([ColorScheme], { nonce: 'abc"123' })
      expect(tag).toStartWith('<script nonce="abc&quot;123">')
      expect(tag).toEndWith("</script>")
      expect(tag.slice(1, -9)).not.toContain("</script>")
    } finally {
      await win.happyDOM.close()
    }
  })
})
