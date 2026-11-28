import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { auditMarkup, checkMarkup, MarkupViolationError } from "../../src/a11y/index.js"

describe("checkMarkup / auditMarkup DOM integrity gate", () => {
  it("passes clean accessible HTML with zero violations", async () => {
    const html = `
      <form>
        <label for="email">Email</label>
        <input id="email" type="email" aria-describedby="email-hint" />
        <p id="email-hint">We never share your email.</p>
        <button type="button" aria-controls="panel-1" aria-expanded="true">Toggle</button>
        <div id="panel-1" role="region" aria-labelledby="panel-title">
          <h2 id="panel-title">Details</h2>
          <a href="/help">Help</a>
        </div>
      </form>
    `
    expect(auditMarkup(html)).toEqual([])
    await Effect.runPromise(checkMarkup(html))
  })

  it("catches planted duplicate IDs, broken ARIA IDREFs, broken label-for, and nested interactive elements", async () => {
    const duplicate = `<div id="dup">A</div><span id="dup">B</span>`
    expect(auditMarkup(duplicate).map((v) => v.rule)).toEqual(["duplicate-id"])

    const brokenAria = `<button aria-controls="missing-panel" aria-labelledby="missing-label">Go</button>`
    expect(auditMarkup(brokenAria).map((v) => v.rule)).toEqual([
      "broken-aria-ref",
      "broken-aria-ref"
    ])

    const brokenLabel = `<label for="ghost-input">Name</label><input id="real-input" />`
    expect(auditMarkup(brokenLabel).map((v) => v.rule)).toEqual(["broken-label-for"])

    const nestedButton = `<button type="button">Outer <button type="button">Inner</button></button>`
    expect(auditMarkup(nestedButton).map((v) => v.rule)).toEqual(["nested-interactive"])

    const nestedLink = `<button type="button"><a href="/docs">Docs</a></button>`
    expect(auditMarkup(nestedLink).map((v) => v.rule)).toEqual(["nested-interactive"])

    const err = await Effect.runPromise(Effect.flip(checkMarkup(nestedButton)))
    expect(err).toBeInstanceOf(MarkupViolationError)
    expect(err.violations[0]?.rule).toBe("nested-interactive")
  })
})
