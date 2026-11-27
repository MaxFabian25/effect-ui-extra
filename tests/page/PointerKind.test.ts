import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import {
  InputModalityTracker,
  inputModalityLayer,
  modalityFromKey,
  modalityFromPointer,
  resolvePointerKind
} from "../../src/page/index.js"

describe("PointerKind and InputModalityTracker", () => {
  test("pure classifiers distinguish coarse/fine pointer, keyboard, pointer, and virtual clicks", () => {
    expect(resolvePointerKind(true, false)).toBe("coarse")
    expect(resolvePointerKind(false, true)).toBe("fine")
    expect(resolvePointerKind(true, true)).toBe("fine")

    expect(modalityFromKey("Shift")).toBeUndefined()
    expect(modalityFromKey("k", { meta: true })).toBeUndefined()
    expect(modalityFromKey("Tab")).toBe("keyboard")

    expect(modalityFromPointer({ pointerType: "mouse", detail: 1, width: 1, height: 1 })).toBe("pointer")
    expect(modalityFromPointer({ pointerType: "", detail: 0, width: 0, height: 0 })).toBe("virtual")
  })

  test("InputModalityTracker updates modality and pointerKind across key and pointer events", () =>
    Effect.runPromise(
      Effect.gen(function*() {
        const tracker = yield* InputModalityTracker
        expect(yield* tracker.get).toEqual({ pointerKind: "fine", modality: "pointer" })

        expect(yield* tracker.recordKey("Shift")).toEqual({ pointerKind: "fine", modality: "pointer" })
        expect(yield* tracker.recordKey("ArrowDown")).toEqual({ pointerKind: "fine", modality: "keyboard" })

        expect(yield* tracker.recordPointer({ pointerType: "touch", detail: 1, width: 10, height: 10 })).toEqual({
          pointerKind: "coarse",
          modality: "pointer"
        })

        expect(yield* tracker.recordPointer({ pointerType: "", detail: 0, width: 0, height: 0 })).toEqual({
          pointerKind: "coarse",
          modality: "virtual"
        })

        expect(yield* tracker.setPointerKind("fine")).toEqual({
          pointerKind: "fine",
          modality: "virtual"
        })
      }).pipe(Effect.provide(inputModalityLayer()))
    ))
})
