import { describe, expect, test } from "bun:test"
import * as Data from "effect/Data"
import { GlobalWindow } from "happy-dom"
import {
  findNextTabbable,
  firstInvalidFieldName,
  getTabbables,
  getVisibleFieldError,
  initialFormValidationState,
  preserveFocusAcrossUpdate,
  reduceFormValidation
} from "../../src/page/index.js"
import type { FormValidationEvent } from "../../src/page/index.js"

const FormEv = Data.taggedEnum<FormValidationEvent>()

describe("DOM tabbable walker and focus preservation", () => {
  test("orders positive tabindex before DOM order, skips hidden/disabled/inert, and wraps", async () => {
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
      document.body.innerHTML = `
        <style>.css-hidden { display: none; } .vis-collapse { visibility: collapse; }</style>
        <div id="root">
          <button id="b0">Zero</button>
          <button id="disabled" disabled>Disabled</button>
          <div inert><button id="inertBtn">Inert</button></div>
          <div class="css-hidden"><button id="cssHiddenBtn">CssHidden</button></div>
          <div class="vis-collapse"><button id="visCollapseBtn">Collapsed</button></div>
          <fieldset disabled>
            <legend><button id="legendBtn">InLegend</button></legend>
            <button id="fieldsetBtn">InFieldset</button>
          </fieldset>
          <details id="closedDetails">
            <summary id="closedSum">More</summary>
            <button id="closedBodyBtn">HiddenInDetails</button>
          </details>
          <details id="openDetails" open>
            <summary id="openSum">Open</summary>
            <button id="openBodyBtn">VisibleInDetails</button>
          </details>
          <button id="bNeg" tabindex="-1">Neg</button>
          <button id="bPos" tabindex="2">Pos</button>
          <a id="link" href="/x">Link</a>
          <input id="hid" type="hidden" />
        </div>
      `
      const root = document.getElementById("root")
      if (root === null) throw new Error("Expected #root")
      const list = getTabbables(root)
      expect(list.map((e) => e.id)).toEqual([
        "bPos",
        "b0",
        "legendBtn",
        "closedSum",
        "openSum",
        "openBodyBtn",
        "link"
      ])

      const lastTabbable = list[list.length - 1] ?? null
      const wrapped = findNextTabbable(root, lastTabbable, "next", { wrap: true })
      expect(wrapped?.id).toBe("bPos")

      // Preserve focus when a DOM node moves in the tree
      const b0 = document.getElementById("b0")
      if (b0 === null) throw new Error("Expected #b0")
      b0.focus()
      const restored = preserveFocusAcrossUpdate(
        document,
        () => {
          root.appendChild(b0)
        },
        () => document.getElementById("b0")
      )
      expect(typeof restored).toBe("boolean")
      expect(document.activeElement?.id).toBe("b0")
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

describe("Form validationMode and server-error focus routing", () => {
  test("respects onBlur, onChange, onSubmit modes, clears server errors on edit, and routes first invalid field", () => {
    let s = initialFormValidationState("onBlur")
    s = reduceFormValidation(
      s,
      FormEv.Changed({ name: "email", clientError: "Invalid email" })
    )
    // Not blurred yet under onBlur mode
    expect(getVisibleFieldError(s, "email")).toBeNull()

    s = reduceFormValidation(
      s,
      FormEv.Blurred({ name: "email", clientError: "Invalid email" })
    )
    expect(getVisibleFieldError(s, "email")).toBe("Invalid email")

    // Server rejection overrides client error and firstInvalidFieldName picks order
    s = reduceFormValidation(
      s,
      FormEv.ServerErrorsReceived({
        errors: { name: "Taken", email: "Already registered" }
      })
    )
    expect(getVisibleFieldError(s, "email")).toBe("Already registered")
    expect(firstInvalidFieldName(s, ["name", "email"])).toBe("name")

    // Editing a server-rejected field clears its stale server error immediately
    s = reduceFormValidation(s, FormEv.Changed({ name: "name", clientError: null }))
    expect(getVisibleFieldError(s, "name")).toBeNull()
    expect(firstInvalidFieldName(s, ["name", "email"])).toBe("email")
  })

  test("onBlur mode implements reward early, punish late via hasShownError", () => {
    let s = initialFormValidationState("onBlur")
    // Blurring while valid marks touched, not hasShownError
    s = reduceFormValidation(s, FormEv.Blurred({ name: "username", clientError: null }))
    expect(getVisibleFieldError(s, "username")).toBeNull()

    // Typing an intermediate invalid value after a valid blur does not prematurely show an error
    s = reduceFormValidation(s, FormEv.Changed({ name: "username", clientError: "Too short" }))
    expect(getVisibleFieldError(s, "username")).toBeNull()

    // Blurring while invalid shows the error and flips hasShownError = true
    s = reduceFormValidation(s, FormEv.Blurred({ name: "username", clientError: "Too short" }))
    expect(getVisibleFieldError(s, "username")).toBe("Too short")

    // Now live edits update and reward immediately when fixed
    s = reduceFormValidation(s, FormEv.Changed({ name: "username", clientError: "Still invalid" }))
    expect(getVisibleFieldError(s, "username")).toBe("Still invalid")
    s = reduceFormValidation(s, FormEv.Changed({ name: "username", clientError: null }))
    expect(getVisibleFieldError(s, "username")).toBeNull()
  })
})
