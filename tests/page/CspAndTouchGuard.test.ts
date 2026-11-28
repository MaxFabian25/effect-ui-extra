import { describe, expect, test } from "bun:test"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import { GlobalWindow } from "happy-dom"
import {
  bindIosModalTouchGuard,
  ColorScheme,
  cspLayer,
  cspScriptTag,
  cspStyleTag,
  getCspConfig,
  getCspNonce,
  initialIosTouchGuardState,
  preferencesScriptWithCsp,
  reduceIosTouchGuard,
  resolveInteractiveTapTarget
} from "../../src/page/index.js"
import type { IosTouchGuardEvent } from "../../src/page/index.js"

const TouchEv = Data.taggedEnum<IosTouchGuardEvent>()

describe("CspContext and CSP tag helpers", () => {
  test("reads nonce from Effect context and escapes closing tags", async () => {
    const out = await Effect.runPromise(
      Effect.gen(function*() {
        const cfg = yield* getCspConfig
        const nonce = yield* getCspNonce
        const prefScript = yield* preferencesScriptWithCsp([ColorScheme])
        return { cfg, nonce, prefScript }
      }).pipe(Effect.provide(cspLayer({ nonce: 'abc"123', disableStyleElements: true })))
    )

    expect(out.nonce).toBe('abc"123')
    expect(out.cfg.disableStyleElements).toBe(true)
    expect(out.prefScript).toContain('<script nonce="abc&quot;123">')
    expect(cspStyleTag("body{color:red}", out.cfg)).toBe("")
    expect(cspStyleTag("body{color:red}</style>", { nonce: "n1" })).toBe(
      '<style nonce="n1">body{color:red}<\\/style></style>'
    )
    expect(cspScriptTag("alert('</script>')", { nonce: "n1" })).toBe(
      '<script nonce="n1">alert(\'<\\/script>\')</script>'
    )
  })

  test("works without CspContext layer provided", async () => {
    const out = await Effect.runPromise(
      Effect.gen(function*() {
        const nonce = yield* getCspNonce
        const script = yield* preferencesScriptWithCsp([ColorScheme])
        return { nonce, script }
      })
    )
    expect(out.nonce).toBeUndefined()
    expect(out.script.startsWith("<script>")).toBe(true)
  })
})

describe("iOS modal touch jitter guard", () => {
  test("blocks first scroll-bleed touchmove yet lets wobbling tap click once", () => {
    let s = initialIosTouchGuardState
    let d = reduceIosTouchGuard(
      s,
      TouchEv.TouchStart({
        point: { x: 100, y: 100 },
        insideModal: true
      })
    )
    s = d.state
    expect(d.preventDefault).toBe(false)

    // Wobbling finger drifts 6px (within default 10px tolerance)
    d = reduceIosTouchGuard(s, TouchEv.TouchMove({ point: { x: 104, y: 104 } }))
    s = d.state
    expect(d.preventDefault).toBe(true)
    expect(s.wobblingTap).toBe(true)

    d = reduceIosTouchGuard(s, TouchEv.TouchEnd({ nowMs: 1000, insideModal: true }))
    s = d.state
    expect(d.synthesizeClick).toBe(true)

    // A second tap immediately within dedupeWindowMs does not double-synthesize
    d = reduceIosTouchGuard(
      s,
      TouchEv.TouchStart({
        point: { x: 100, y: 100 },
        insideModal: true
      })
    )
    d = reduceIosTouchGuard(d.state, TouchEv.TouchMove({ point: { x: 102, y: 102 } }))
    d = reduceIosTouchGuard(d.state, TouchEv.TouchEnd({ nowMs: 1100, insideModal: true }))
    expect(d.synthesizeClick).toBe(false)
  })

  test("does not synthesize click when finger scrolls past jitter tolerance", () => {
    let d = reduceIosTouchGuard(
      initialIosTouchGuardState,
      TouchEv.TouchStart({
        point: { x: 50, y: 50 },
        insideModal: true
      })
    )
    d = reduceIosTouchGuard(d.state, TouchEv.TouchMove({ point: { x: 50, y: 80 } }))
    expect(d.preventDefault).toBe(false)
    expect(d.state.wobblingTap).toBe(false)

    d = reduceIosTouchGuard(d.state, TouchEv.TouchEnd({ nowMs: 2000, insideModal: true }))
    expect(d.synthesizeClick).toBe(false)
  })

  test("resolves nested icon inside button within modal root and cleans up listeners", async () => {
    const win = new GlobalWindow({ url: "http://localhost/" })
    const keys = ["document", "Element", "HTMLElement", "Node"] as const
    const saved = new Map<string, PropertyDescriptor | undefined>()
    for (const key of keys) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value: Reflect.get(win, key)
      })
    }
    try {
      document.body.innerHTML = `<div id="modal"><button id="btn"><span id="icon">×</span></button><button id="dis" disabled><span id="disIcon">×</span></button><div id="ariaDis" role="button" aria-disabled="true"><span id="ariaDisIcon">×</span></div></div><button id="outside">Out</button>`
      const modal = document.getElementById("modal")
      const btn = document.getElementById("btn")
      const icon = document.getElementById("icon")
      const disIcon = document.getElementById("disIcon")
      const ariaDisIcon = document.getElementById("ariaDisIcon")
      const outside = document.getElementById("outside")
      if (
        modal === null ||
        btn === null ||
        icon === null ||
        disIcon === null ||
        ariaDisIcon === null ||
        outside === null
      ) {
        throw new Error("Expected modal DOM elements")
      }

      expect(resolveInteractiveTapTarget(icon, modal)).toBe(btn)
      expect(resolveInteractiveTapTarget(disIcon, modal)).toBeNull()
      expect(resolveInteractiveTapTarget(ariaDisIcon, modal)).toBeNull()
      expect(resolveInteractiveTapTarget(outside, modal)).toBeNull()

      const unbind = bindIosModalTouchGuard(modal)
      expect(typeof unbind).toBe("function")
      unbind()
    } finally {
      for (const [key, desc] of saved) {
        if (desc === undefined) {
          Reflect.deleteProperty(globalThis, key)
        } else {
          Object.defineProperty(globalThis, key, desc)
        }
      }
      await win.happyDOM.close()
    }
  })
})
