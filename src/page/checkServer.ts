import type { Component, View } from "@effect/ui"
import type { BrowserHost, Html } from "@effect/ui/html"
import { HtmlServer } from "@effect/ui/html"
import * as Clock from "effect/Clock"
import * as Data from "effect/Data"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"

export interface ServerPurityViolation {
  readonly kind: "browser-global" | "clock" | "random" | "serialization"
  readonly symbol: string
  readonly message: string
}

export class ServerPurityError extends Data.TaggedError("ServerPurityError")<{
  readonly componentName: string
  readonly violations: ReadonlyArray<ServerPurityViolation>
}> {
  override get message(): string {
    const lines = this.violations.map(
      (v, i) => `  ${i + 1}. [${v.kind}] ${v.symbol}: ${v.message}`
    )
    return `${this.componentName}: ${this.violations.length} SSR purity violation${
      this.violations.length === 1 ? "" : "s"
    }\n${lines.join("\n")}`
  }
}

export interface CheckServerOptions {
  /** Also flag `Date.now()` and zero-arg `new Date()` reads during SSR. Defaults to `true`. */
  readonly forbidClock?: boolean | undefined
  /** Also flag `Math.random()` and `crypto.randomUUID()` reads during SSR. Defaults to `true`. */
  readonly forbidRandom?: boolean | undefined
  /** Forwarded to `HtmlServer.renderToHtml`. */
  readonly renderOptions?: Parameters<typeof HtmlServer.renderToHtml>[2] | undefined
}

const BROWSER_GLOBALS = [
  "document",
  "window",
  "navigator",
  "location",
  "localStorage",
  "sessionStorage",
  "matchMedia",
  "history",
  "screen",
  "ResizeObserver",
  "IntersectionObserver",
  "MutationObserver"
] as const

/**
 * Renders an `@effect/ui` component via `HtmlServer.renderToHtml` while
 * isolating browser globals, wall-clock calls, and randomness so any impure
 * read during SSR is recorded and returned alongside the rendered output.
 */
export const auditServer = <
  Name extends string,
  Props,
  Model,
  Msg,
  Events,
  R,
  V extends View.Elements = Html.Elements
>(
  component:
    & Component.Members<
      Name,
      Props,
      Model,
      Msg,
      Events,
      R,
      V,
      any
    >
    & BrowserHost.HtmlRoot<V>,
  props: Props,
  options: CheckServerOptions = {}
): Effect.Effect<
  {
    readonly rendered: HtmlServer.Rendered<Model> | undefined
    readonly violations: ReadonlyArray<ServerPurityViolation>
  },
  never,
  Exclude<R, Html.Host>
> =>
  Effect.suspend(() => {
    const forbidClock = options.forbidClock ?? true
    const forbidRandom = options.forbidRandom ?? true
    const violations: Array<ServerPurityViolation> = []
    const seen = new Set<string>()
    const record = (v: ServerPurityViolation) => {
      const k = `${v.kind}:${v.symbol}`
      if (!seen.has(k)) {
        seen.add(k)
        violations.push(v)
      }
    }

    const restores: Array<() => void> = []
    const patch = (
      target: object,
      key: string,
      descriptor: PropertyDescriptor
    ) => {
      const original = Object.getOwnPropertyDescriptor(target, key)
      Object.defineProperty(target, key, { configurable: true, ...descriptor })
      restores.push(() => {
        if (original === undefined) {
          Reflect.deleteProperty(target, key)
        } else {
          Object.defineProperty(target, key, original)
        }
      })
    }

    const origDateNow = Date.now.bind(Date)
    const isolatedClock: Clock.Clock = {
      currentTimeMillisUnsafe: () => origDateNow(),
      currentTimeMillis: Effect.sync(() => origDateNow()),
      monotonicTimeNanosUnsafe: () => BigInt(origDateNow()) * 1_000_000n,
      monotonicTimeNanos: Effect.sync(() => BigInt(origDateNow()) * 1_000_000n),
      currentTimeNanosUnsafe: () => BigInt(origDateNow()) * 1_000_000n,
      currentTimeNanos: Effect.sync(() => BigInt(origDateNow()) * 1_000_000n),
      sleep: (duration) =>
        Effect.callback((resume) => {
          const ms = Math.max(0, Duration.toMillis(duration))
          const timer = setTimeout(() => resume(Effect.void), ms)
          return Effect.sync(() => clearTimeout(timer))
        })
    }

    const install = Effect.sync(() => {
      for (const name of BROWSER_GLOBALS) {
        patch(globalThis, name, {
          enumerable: false,
          get() {
            record({
              kind: "browser-global",
              symbol: name,
              message: `Component read browser global "${name}" during SSR.`
            })
            return undefined
          }
        })
      }

      if (forbidClock) {
        patch(Date, "now", {
          writable: true,
          value: () => {
            record({
              kind: "clock",
              symbol: "Date.now",
              message:
                "Component called Date.now() during SSR; read time from Effect Clock or props so SSR and hydration match."
            })
            return origDateNow()
          }
        })
      }

      if (forbidRandom) {
        const origRandom = Math.random
        patch(Math, "random", {
          writable: true,
          value: () => {
            record({
              kind: "random",
              symbol: "Math.random",
              message:
                "Component called Math.random() during SSR; pass deterministic values or Effect Random so SSR and hydration match."
            })
            return origRandom.call(Math)
          }
        })
        if (typeof globalThis.crypto?.randomUUID === "function") {
          const origUuid = globalThis.crypto.randomUUID.bind(globalThis.crypto)
          patch(globalThis.crypto, "randomUUID", {
            writable: true,
            value: () => {
              record({
                kind: "random",
                symbol: "crypto.randomUUID",
                message:
                  "Component called crypto.randomUUID() during SSR; use deterministic keys or Effect IDs so SSR and hydration match."
              })
              return origUuid()
            }
          })
        }
      }
    })

    const restore = Effect.sync(() => {
      for (let i = restores.length - 1; i >= 0; i--) {
        restores[i]?.()
      }
    })

    return Effect.acquireUseRelease(
      install,
      () =>
        Effect.gen(function*() {
          const rendered = yield* HtmlServer.renderToHtml(
            component,
            props,
            options.renderOptions
          ).pipe(
            Effect.provideService(Clock.Clock, isolatedClock),
            Effect.catchDefect((defect) => {
              record({
                kind: "browser-global",
                symbol: "renderToHtml",
                message: `SSR threw while browser globals were isolated: ${
                  defect instanceof Error ? defect.message : String(defect)
                }`
              })
              return Effect.undefined
            })
          )

          if (rendered !== undefined) {
            const serialized = HtmlServer.serializeState(rendered.state)
            if (/<\/script/i.test(serialized)) {
              record({
                kind: "serialization",
                symbol: "serializeState",
                message: "Serialized SSR state contains an unescaped </script> sequence."
              })
            }
          }

          return {
            rendered,
            violations
          }
        }),
      () => restore
    )
  })

/**
 * Verifies an `@effect/ui` component renders cleanly on the server without
 * reading browser globals, `Date.now()`, or `Math.random()`. Returns the
 * `HtmlServer.Rendered` result on success or fails with `ServerPurityError`.
 */
export const checkServer = <
  Name extends string,
  Props,
  Model,
  Msg,
  Events,
  R,
  V extends View.Elements = Html.Elements
>(
  component:
    & Component.Members<
      Name,
      Props,
      Model,
      Msg,
      Events,
      R,
      V,
      any
    >
    & BrowserHost.HtmlRoot<V>,
  props: Props,
  options: CheckServerOptions = {}
): Effect.Effect<HtmlServer.Rendered<Model>, ServerPurityError, Exclude<R, Html.Host>> =>
  Effect.flatMap(auditServer(component, props, options), ({ rendered, violations }) =>
    violations.length === 0 && rendered !== undefined
      ? Effect.succeed(rendered)
      : Effect.fail(
          new ServerPurityError({
            componentName:
              "name" in component && typeof component.name === "string"
                ? component.name
                : "Component",
            violations
          })
        )
  )
