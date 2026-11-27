import { Subscription } from "@effect/ui"
import { HtmlHead } from "@effect/ui/html"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"

export type StorageKind = "local" | "session" | "cookie"

export interface StorageChange {
  readonly key: string
  readonly value: string | undefined
}

export interface PreferenceStorageService {
  readonly kind: StorageKind
  readonly get: (key: string) => Effect.Effect<string | undefined>
  readonly set: (key: string, value: string) => Effect.Effect<void>
  readonly remove: (key: string) => Effect.Effect<void>
  readonly changes: Stream.Stream<StorageChange>
}

/**
 * Storage backend for persistent UI preferences (`localStorage`, `sessionStorage`,
 * `cookie`, or in-memory for `TestHost` and SSR).
 */
export class PreferenceStorage extends Context.Service<
  PreferenceStorage,
  PreferenceStorageService
>()("effect-ui-page/PreferenceStorage") {}

export interface MemoryStorageHandle extends PreferenceStorageService {
  /** Simulates another browser tab updating or removing a stored key. */
  readonly simulateExternalChange: (
    key: string,
    value: string | undefined
  ) => Effect.Effect<void>
  readonly snapshot: () => Readonly<Record<string, string>>
}

/**
 * Creates a deterministic in-memory `PreferenceStorage` for `TestHost` and SSR.
 */
export const makeMemoryStorage = (
  initial: Readonly<Record<string, string>> = {},
  kind: StorageKind = "local"
): Effect.Effect<MemoryStorageHandle> =>
  Effect.gen(function*() {
    const store = new Map<string, string>(Object.entries(initial))
    const pubsub = yield* PubSub.unbounded<StorageChange>()

    const get = (key: string) => Effect.sync(() => store.get(key))
    const set = (key: string, value: string) =>
      Effect.gen(function*() {
        store.set(key, value)
        yield* PubSub.publish(pubsub, { key, value })
      })
    const remove = (key: string) =>
      Effect.gen(function*() {
        store.delete(key)
        yield* PubSub.publish(pubsub, { key, value: undefined })
      })
    const simulateExternalChange = (key: string, value: string | undefined) =>
      Effect.gen(function*() {
        if (value === undefined) store.delete(key)
        else store.set(key, value)
        yield* PubSub.publish(pubsub, { key, value })
      })

    return {
      kind,
      get,
      set,
      remove,
      changes: Stream.fromPubSub(pubsub),
      simulateExternalChange,
      snapshot: () => Object.fromEntries(store.entries())
    }
  })

export const memoryStorageLayer = (
  initial: Readonly<Record<string, string>> = {},
  kind: StorageKind = "local"
): Layer.Layer<PreferenceStorage> =>
  Layer.effect(PreferenceStorage, makeMemoryStorage(initial, kind))

const parseCookies = (cookieHeader: string): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=")
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k.length === 0) continue
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(v)
    } catch {
      out[k] = v
    }
  }
  return out
}

/**
 * Cookie-backed `PreferenceStorage`. Pass an HTTP `Cookie` request header on the
 * server so SSR reads saved choices before hydration; omit it in the browser to
 * use `document.cookie`.
 */
export const cookieStorageLayer = (
  cookieHeader?: string,
  options?: { readonly maxAgeSeconds?: number | undefined; readonly path?: string | undefined }
): Layer.Layer<PreferenceStorage> =>
  Layer.effect(
    PreferenceStorage,
    Effect.gen(function*() {
      const pubsub = yield* PubSub.unbounded<StorageChange>()
      const maxAge = options?.maxAgeSeconds ?? 31_536_000
      const path = options?.path ?? "/"
      const serverCookies =
        cookieHeader !== undefined ? parseCookies(cookieHeader) : undefined

      const readAll = (): Record<string, string> => {
        if (serverCookies !== undefined) return serverCookies
        if (typeof document === "undefined") return {}
        return parseCookies(document.cookie)
      }

      const get = (key: string) => Effect.sync(() => readAll()[key])
      const set = (key: string, value: string) =>
        Effect.gen(function*() {
          if (serverCookies !== undefined) {
            serverCookies[key] = value
          } else if (typeof document !== "undefined") {
            document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}; SameSite=Lax`
          }
          yield* PubSub.publish(pubsub, { key, value })
        })
      const remove = (key: string) =>
        Effect.gen(function*() {
          if (serverCookies !== undefined) {
            delete serverCookies[key]
          } else if (typeof document !== "undefined") {
            document.cookie = `${encodeURIComponent(key)}=; Path=${path}; Max-Age=0; SameSite=Lax`
          }
          yield* PubSub.publish(pubsub, { key, value: undefined })
        })

      return {
        kind: "cookie" as const,
        get,
        set,
        remove,
        changes: Stream.fromPubSub(pubsub)
      }
    })
  )

/**
 * Browser `localStorage` or `sessionStorage` backend with cross-tab `storage`
 * event syncing. Falls back safely when storage is unavailable or blocked.
 */
export const browserStorageLayer = (
  kind: "local" | "session" = "local"
): Layer.Layer<PreferenceStorage> =>
  Layer.effect(
    PreferenceStorage,
    Effect.gen(function*() {
      const pubsub = yield* PubSub.unbounded<StorageChange>()
      const getWebStorage = (): Storage | undefined => {
        if (typeof window === "undefined") return undefined
        try {
          return kind === "local" ? window.localStorage : window.sessionStorage
        } catch {
          return undefined
        }
      }

      const get = (key: string) =>
        Effect.sync(() => {
          try {
            return getWebStorage()?.getItem(key) ?? undefined
          } catch {
            return undefined
          }
        })

      const set = (key: string, value: string) =>
        Effect.gen(function*() {
          try {
            getWebStorage()?.setItem(key, value)
          } catch {
            // Storage quota or private browsing mode; keep event flow alive.
          }
          yield* PubSub.publish(pubsub, { key, value })
        })

      const remove = (key: string) =>
        Effect.gen(function*() {
          try {
            getWebStorage()?.removeItem(key)
          } catch {
            // Ignore blocked storage writes.
          }
          yield* PubSub.publish(pubsub, { key, value: undefined })
        })

      const external = Stream.callback<StorageChange>((queue) =>
        Effect.sync(() => {
          if (typeof window === "undefined") return undefined
          const target = getWebStorage()
          const onStorage = (event: StorageEvent) => {
            if (target !== undefined && event.storageArea !== target) return
            if (event.key === null) return
            Queue.offerUnsafe(queue, {
              key: event.key,
              value: event.newValue ?? undefined
            })
          }
          window.addEventListener("storage", onStorage)
          return Effect.sync(() => window.removeEventListener("storage", onStorage))
        })
      )

      return {
        kind,
        get,
        set,
        remove,
        changes: Stream.merge(Stream.fromPubSub(pubsub), external)
      }
    })
  )

// ---------------------------------------------------------------------------
// Preference definition & zero-FOUC SSR script
// ---------------------------------------------------------------------------

const ATTR_RE = /^data-[a-z0-9-]+$/
const KEY_RE = /^[A-Za-z0-9._:-]+$/

export interface PreferenceSpec<Value extends string = string> {
  /** Storage key in localStorage, sessionStorage, or cookie. */
  readonly key: string
  /** HTML `data-*` attribute set on `<html>` (must match `/^data-[a-z0-9-]+$/`). */
  readonly attribute: `data-${string}`
  /** Allowed literal values. Saved values outside this list fall back to `defaultValue`. */
  readonly values: readonly [Value, ...ReadonlyArray<Value>]
  /** Fallback value when nothing valid is saved. */
  readonly defaultValue: NoInfer<Value>
  /** Storage hint for `preferencesScript`. Defaults to `"local"`. */
  readonly storageKind?: StorageKind | undefined
}

export interface Preference<Value extends string> extends PreferenceSpec<Value> {
  readonly parse: (raw: string | undefined) => Value
  readonly read: Effect.Effect<Value, never, PreferenceStorage>
  readonly write: (value: Value) => Effect.Effect<void, never, PreferenceStorage>
  readonly clear: Effect.Effect<void, never, PreferenceStorage>
  /** Returns an `HtmlHead.htmlData` entry to bind this preference on `<html>`. */
  readonly headEntry: (value: Value) => HtmlHead.HtmlData
  /**
   * Keyed `@effect/ui` Subscription that emits the saved preference on mount
   * and every subsequent local or cross-tab change.
   */
  readonly subscription: <Msg>(
    onChange: (value: Value) => Msg
  ) => Subscription.Subscription<Msg, PreferenceStorage>
}

const assertValidSpec = (spec: PreferenceSpec<string>): void => {
  if (!ATTR_RE.test(spec.attribute)) {
    throw new Error(
      `Invalid preference attribute "${spec.attribute}": must match /^data-[a-z0-9-]+$/.`
    )
  }
  if (!KEY_RE.test(spec.key)) {
    throw new Error(
      `Invalid preference key "${spec.key}": must match /^[A-Za-z0-9._:-]+$/.`
    )
  }
  if (!spec.values.includes(spec.defaultValue)) {
    throw new Error(
      `Preference "${spec.key}" defaultValue "${spec.defaultValue}" is not in values [${spec.values.join(", ")}].`
    )
  }
}

export const definePreference = <const Value extends string>(
  spec: PreferenceSpec<Value>
): Preference<Value> => {
  assertValidSpec(spec)
  const allowed = new Set<string>(spec.values)
  const parse = (raw: string | undefined): Value =>
    raw !== undefined && allowed.has(raw) ? (raw as Value) : spec.defaultValue

  const applyToDocument = (value: Value): void => {
    if (typeof document !== "undefined" && document.documentElement !== null) {
      document.documentElement.setAttribute(spec.attribute, value)
      if (spec.attribute === "data-color-scheme") {
        const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')
        if (meta !== null) {
          meta.content = value === "light" || value === "dark" ? value : "light dark"
        }
      }
    }
  }

  const read: Effect.Effect<Value, never, PreferenceStorage> =
    PreferenceStorage.use((storage) => Effect.map(storage.get(spec.key), parse))

  const write = (value: Value): Effect.Effect<void, never, PreferenceStorage> =>
    PreferenceStorage.use((storage) => {
      const next = parse(value)
      return Effect.tap(storage.set(spec.key, next), () =>
        Effect.sync(() => applyToDocument(next))
      )
    })

  const clear: Effect.Effect<void, never, PreferenceStorage> =
    PreferenceStorage.use((storage) =>
      Effect.tap(storage.remove(spec.key), () =>
        Effect.sync(() => applyToDocument(spec.defaultValue))
      )
    )

  const headEntry = (value: Value): HtmlHead.HtmlData =>
    HtmlHead.htmlData(spec.attribute, parse(value))

  const subscription = <Msg>(
    onChange: (value: Value) => Msg
  ): Subscription.Subscription<Msg, PreferenceStorage> =>
    Subscription.make(
      `effect-ui-page/preference/${spec.key}`,
      Stream.unwrap(
        PreferenceStorage.use((storage) =>
          Effect.map(storage.get(spec.key), (initialRaw) => {
            const initial = parse(initialRaw)
            const initialStream = Stream.make(initial)
            const updates = storage.changes.pipe(
              Stream.filter((ev) => ev.key === spec.key),
              Stream.map((ev) => parse(ev.value))
            )
            return Stream.concat(initialStream, updates).pipe(
              Stream.changes,
              Stream.tap((val) => Effect.sync(() => applyToDocument(val))),
              Stream.map(onChange)
            )
          })
        )
      )
    )

  return {
    ...spec,
    parse,
    read,
    write,
    clear,
    headEntry,
    subscription
  }
}

// ---------------------------------------------------------------------------
// ColorScheme
// ---------------------------------------------------------------------------

export type ColorSchemeValue = "system" | "light" | "dark"
export type SystemColorScheme = "light" | "dark" | "unknown"

export const ColorScheme = definePreference({
  key: "color-scheme",
  attribute: "data-color-scheme",
  values: ["system", "light", "dark"] as const,
  defaultValue: "system",
  storageKind: "local"
})

/**
 * Resolves the effective color scheme from the user's preference and the
 * system preference.
 */
export const resolveColorScheme = (
  choice: ColorSchemeValue,
  system: SystemColorScheme
): SystemColorScheme => (choice === "system" ? system : choice)

/**
 * Reads the `Sec-CH-Prefers-Color-Scheme` HTTP request header so SSR knows the
 * browser's color scheme before hydration when Client Hints are enabled.
 */
export const colorSchemeFromHeaders = (
  headers:
    | Headers
    | Readonly<Record<string, string | ReadonlyArray<string> | undefined>>
): SystemColorScheme => {
  let raw: string | undefined
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    raw = headers.get("sec-ch-prefers-color-scheme") ?? undefined
  } else {
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === "sec-ch-prefers-color-scheme") {
        raw = Array.isArray(v) ? v[0] : (v as string | undefined)
        break
      }
    }
  }
  const normalized = raw?.replace(/^"|"$/g, "").trim().toLowerCase()
  if (normalized === "dark") return "dark"
  if (normalized === "light") return "light"
  return "unknown"
}

// ---------------------------------------------------------------------------
// Zero-FOUC SSR inline script generator
// ---------------------------------------------------------------------------

const safeJson = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")

const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

/**
 * Generates the raw JavaScript body that synchronously restores saved
 * preferences onto `<html>` before first paint, eliminating theme/density FOUC.
 */
export const preferencesScriptBody = (
  specs: ReadonlyArray<PreferenceSpec<string>>
): string => {
  for (const spec of specs) assertValidSpec(spec)
  const payload = specs.map((s) => [
    s.key,
    s.attribute,
    s.values,
    s.defaultValue,
    s.storageKind ?? "local"
  ])
  return `(function(){try{var d=document.documentElement,c=null,s=${safeJson(payload)};for(var i=0;i<s.length;i++){var p=s[i],v=null;if(p[4]==="cookie"){if(c===null){c={};var parts=document.cookie.split(";");for(var j=0;j<parts.length;j++){var eq=parts[j].indexOf("=");if(eq>0){try{c[decodeURIComponent(parts[j].slice(0,eq).trim())]=decodeURIComponent(parts[j].slice(eq+1).trim())}catch(e){}}}}v=c[p[0]]}else{var st=p[4]==="session"?window.sessionStorage:window.localStorage;v=st?st.getItem(p[0]):null}d.setAttribute(p[1],v!==null&&p[2].indexOf(v)!==-1?v:p[3])}}catch(e){}})();`
}

/**
 * Emits a `<script>` tag to place inside SSR `<head>` before stylesheets/body.
 */
export const preferencesScript = (
  specs: ReadonlyArray<PreferenceSpec<string>>,
  options?: { readonly nonce?: string | undefined }
): string => {
  const nonceAttr =
    options?.nonce !== undefined && options.nonce.length > 0
      ? ` nonce="${escapeAttr(options.nonce)}"`
      : ""
  return `<script${nonceAttr}>${preferencesScriptBody(specs)}</script>`
}
