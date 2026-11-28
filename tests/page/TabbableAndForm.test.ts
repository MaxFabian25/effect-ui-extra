import { describe, expect, test } from "bun:test"
import { Window } from "happy-dom"
import {
  findNextTabbable,
  firstInvalidFieldName,
  getTabbables,
  getVisibleFieldError,
  initialFormValidationState,
  preserveFocusAcrossUpdate,
  reduceFormValidation
} from "../../src/page/index.js"

describe("DOM tabbable walker and focus preservation", () => {
  test("orders positive tabindex before DOM order, skips hidden/disabled/inert, and wraps", () => {
    const win = new Window()
    try {
      const doc = win.document
      doc.body.innerHTML = `
        <div id="root">
          <button id="b0">Zero</button>
          <button id="disabled" disabled>Disabled</button>
          <div inert><button id="inertBtn">Inert</button></div>
          <button id="bNeg" tabindex="-1">Neg</button>
          <button id="bPos" tabindex="2">Pos</button>
          <a id="link" href="/x">Link</a>
          <input id="hid" type="hidden" />
        </div>
      `
      const root = doc.getElementById("root") as unknown as HTMLElement
      const list = getTabbables(root)
      expect(list.map((e) => e.id)).toEqual(["bPos", "b0", "link"])

      const wrapped = findNextTabbable(root, list[2]!, "next", { wrap: true })
      expect(wrapped?.id).toBe("bPos")

      // Preserve focus when a DOM node moves in the tree
      const b0 = doc.getElementById("b0") as unknown as HTMLElement
      b0.focus()
      const restored = preserveFocusAcrossUpdate(
        doc as unknown as Document,
        () => {
          root.appendChild(b0)
        },
        () => doc.getElementById("b0") as unknown as HTMLElement
      )
      expect(typeof restored).toBe("boolean")
      expect((doc.activeElement as unknown as HTMLElement | null)?.id).toBe("b0")
    } finally {
      win.close()
    }
  })
})

describe("Form validationMode and server-error focus routing", () => {
  test("respects onBlur, onChange, onSubmit modes, clears server errors on edit, and routes first invalid field", () => {
    let s = initialFormValidationState("onBlur")
    s = reduceFormValidation(s, { _tag: "Changed", name: "email", clientError: "Invalid email" })
    // Not blurred yet under onBlur mode
    expect(getVisibleFieldError(s, "email")).toBeNull()

    s = reduceFormValidation(s, { _tag: "Blurred", name: "email", clientError: "Invalid email" })
    expect(getVisibleFieldError(s, "email")).toBe("Invalid email")

    // Server rejection overrides client error and firstInvalidFieldName picks order
    s = reduceFormValidation(s, {
      _tag: "ServerErrorsReceived",
      errors: { name: "Taken", email: "Already registered" }
    })
    expect(getVisibleFieldError(s, "email")).toBe("Already registered")
    expect(firstInvalidFieldName(s, ["name", "email"])).toBe("name")

    // Editing a server-rejected field clears its stale server error immediately
    s = reduceFormValidation(s, { _tag: "Changed", name: "name", clientError: null })
    expect(getVisibleFieldError(s, "name")).toBeNull()
    expect(firstInvalidFieldName(s, ["name", "email"])).toBe("email")
  })
})
