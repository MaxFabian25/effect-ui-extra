import { describe, expect, test } from "bun:test"
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
  test("blends hex and rgb theme colors toward black and restores meta tags cleanly", () => {
    expect(blendThemeColor("#ffffff", 1, 0.5)).toBe("#808080")
    expect(blendThemeColor("rgb(200, 100, 50)", 1, 0.5)).toBe("#643219")
    expect(blendThemeColor("not-a-color", 1, 0.5)).toBeUndefined()

    const meta = { content: "#ffffff" } as HTMLMetaElement
    const fakeDoc = {
      querySelectorAll: () => [meta] as unknown as NodeListOf<Element>
    }
    const dimmer = createThemeColorDimmer(fakeDoc, 0.5)
    dimmer.write(1)
    expect(meta.content).toBe("#808080")
    dimmer.restore()
    expect(meta.content).toBe("#ffffff")
  })
})
