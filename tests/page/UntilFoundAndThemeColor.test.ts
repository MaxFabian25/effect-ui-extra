import { describe, expect, test } from "bun:test"
import { GlobalWindow } from "happy-dom"
import {
  bindBeforeMatch,
  blendThemeColor,
  chunkFindableRows,
  createThemeColorDimmer,
  panelHiddenAttr
} from "../../src/page/index.js"

describe("hidden='until-found' and beforematch helpers", () => {
  test("computes panelHiddenAttr across open, findable, and unsupported runtimes", () => {
    expect(panelHiddenAttr({ open: true, findable: true, untilFoundSupported: true })).toBeUndefined()
    expect(panelHiddenAttr({ open: false, findable: true, untilFoundSupported: true })).toBe("until-found")
    expect(panelHiddenAttr({ open: false, findable: true, untilFoundSupported: false })).toBe("")
    expect(panelHiddenAttr({ open: false, findable: false, untilFoundSupported: true })).toBe("")
  })

  test("chunks virtualized rows into stand-in groups and binds/unbinds beforematch", () => {
    const groups = chunkFindableRows(["a", "b", "c", "d", "e"], 2)
    expect(groups).toEqual([
      { groupIndex: 0, startIndex: 0, items: ["a", "b"] },
      { groupIndex: 1, startIndex: 2, items: ["c", "d"] },
      { groupIndex: 2, startIndex: 4, items: ["e"] }
    ])

    const target = new EventTarget()
    let revealed = 0
    const off = bindBeforeMatch(target, () => {
      revealed += 1
    })
    target.dispatchEvent(new Event("beforematch"))
    expect(revealed).toBe(1)
    off()
    target.dispatchEvent(new Event("beforematch"))
    expect(revealed).toBe(1)
  })
})

describe("dimThemeColor", () => {
  test("blends hex, rgb, and oklch theme colors toward black and re-snapshots meta tags across theme changes", async () => {
    expect(blendThemeColor("#ffffff", 1, 0.5)).toBe("#808080")
    expect(blendThemeColor("rgb(200, 100, 50)", 1, 0.5)).toBe("#643219")
    expect(blendThemeColor("oklch(0.99 0.002 260)", 1, 0.5)).toMatch(/^#[0-9a-f]{6}$/)
    expect(blendThemeColor("not-a-color", 1, 0.5)).toBeUndefined()

    const win = new GlobalWindow({ url: "http://localhost/" })
    const origDocDesc = Object.getOwnPropertyDescriptor(globalThis, "document")
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: win.document
    })
    try {
      const meta = document.createElement("meta")
      meta.name = "theme-color"
      meta.content = "#ffffff"
      document.head.appendChild(meta)

      const dimmer = createThemeColorDimmer(document, 0.5)
      dimmer.write(1)
      expect(meta.content).toBe("#808080")
      dimmer.restore()
      expect(meta.content).toBe("#ffffff")

      // Theme toggled while modal closed -> next dim snapshots the new dark color
      meta.content = "#101010"
      dimmer.write(1)
      expect(meta.content).toBe("#080808")
      dimmer.restore()
      expect(meta.content).toBe("#101010")
    } finally {
      if (origDocDesc === undefined) {
        Reflect.deleteProperty(globalThis, "document")
      } else {
        Object.defineProperty(globalThis, "document", origDocDesc)
      }
      await win.happyDOM.close()
    }
  })
})
