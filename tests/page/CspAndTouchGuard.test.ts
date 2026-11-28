import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { Window } from "happy-dom"
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
    let d = reduceIosTouchGuard(s, {
      _tag: "TouchStart",
      point: { x: 100, y: 100 },
      insideModal: true
    })
    s = d.state
    expect(d.preventDefault).toBe(false)

    // Wobbling finger drifts 6px (within default 10px tolerance)
    d = reduceIosTouchGuard(s, { _tag: "TouchMove", point: { x: 104, y: 104 } })
    s = d.state
    expect(d.preventDefault).toBe(true)
    expect(s.wobblingTap).toBe(true)

    d = reduceIosTouchGuard(s, { _tag: "TouchEnd", nowMs: 1000, insideModal: true })
    s = d.state
    expect(d.synthesizeClick).toBe(true)

    // A second tap immediately within dedupeWindowMs does not double-synthesize
    d = reduceIosTouchGuard(s, {
      _tag: "TouchStart",
      point: { x: 100, y: 100 },
      insideModal: true
    })
    d = reduceIosTouchGuard(d.state, { _tag: "TouchMove", point: { x: 102, y: 102 } })
    d = reduceIosTouchGuard(d.state, { _tag: "TouchEnd", nowMs: 1100, insideModal: true })
    expect(d.synthesizeClick).toBe(false)
  })

  test("does not synthesize click when finger scrolls past jitter tolerance", () => {
    let d = reduceIosTouchGuard(initialIosTouchGuardState, {
      _tag: "TouchStart",
      point: { x: 50, y: 50 },
      insideModal: true
    })
    d = reduceIosTouchGuard(d.state, { _tag: "TouchMove", point: { x: 50, y: 80 } })
    expect(d.preventDefault).toBe(false)
    expect(d.state.wobblingTap).toBe(false)

    d = reduceIosTouchGuard(d.state, { _tag: "TouchEnd", nowMs: 2000, insideModal: true })
    expect(d.synthesizeClick).toBe(false)
  })

  test("resolves nested icon inside button within modal root and cleans up listeners", () => {
    const win = new Window()
    const prevElement = globalThis.Element
    const prevNode = globalThis.Node
    ;(globalThis as unknown as { Element: unknown }).Element = win.Element
    ;(globalThis as unknown as { Node: unknown }).Node = win.Node
    try {
      const doc = win.document
      doc.body.innerHTML = `<div id="modal"><button id="btn"><span id="icon">×</span></button><button id="dis" disabled><span id="disIcon">×</span></button><div id="ariaDis" role="button" aria-disabled="true"><span id="ariaDisIcon">×</span></div></div><button id="outside">Out</button>`
      const modal = doc.getElementById("modal") as unknown as HTMLElement
      const btn = doc.getElementById("btn") as unknown as HTMLElement
      const icon = doc.getElementById("icon") as unknown as HTMLElement
      const disIcon = doc.getElementById("disIcon") as unknown as HTMLElement
      const ariaDisIcon = doc.getElementById("ariaDisIcon") as unknown as HTMLElement
      const outside = doc.getElementById("outside") as unknown as HTMLElement

      expect(resolveInteractiveTapTarget(icon, modal)).toBe(btn)
      expect(resolveInteractiveTapTarget(disIcon, modal)).toBeNull()
      expect(resolveInteractiveTapTarget(ariaDisIcon, modal)).toBeNull()
      expect(resolveInteractiveTapTarget(outside, modal)).toBeNull()

      const unbind = bindIosModalTouchGuard(modal)
      expect(typeof unbind).toBe("function")
      unbind()
    } finally {
      ;(globalThis as unknown as { Element: unknown }).Element = prevElement
      ;(globalThis as unknown as { Node: unknown }).Node = prevNode
      win.close()
    }
  })
})
