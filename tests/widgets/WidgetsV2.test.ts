import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import { HtmlLocator, HtmlPlay } from "@effect/ui/html/testing"
import { TestHost } from "@effect/ui/testing"
import { describe, expect, it } from "bun:test"
import { Duration, Effect, Layer, Schema } from "effect"
import { TestClock } from "effect/testing"
import { A11yFocus, checkDirection, checkPattern } from "../../src/a11y/index.js"
import { checkServer } from "../../src/page/index.js"
import { addTokens, applyTriggerSelection, buildPaginationRange, computeIndicatorGeometry, computeTreeCheckStates, detectTrigger, getCheckedByStrategy, initialStickToBottomState, InlineEdit, jumpToBottom, makeAsyncOptionsLoader, onStickContentGrowth, onStickScroll, Pagination, parseTokenText, SegmentedControl, TokenInput, toggleTreeNodeCheck, TriggerMenu } from '../../src/widgets/index.js';
import type { TreeNode } from '../../src/widgets/index.js';

const playLayer = Layer.mergeAll(
  TestHost.layer(),
  A11yFocus.layer,
  TestClock.layer()
)

const runPlay = <A, E>(
  eff: Effect.Effect<
    A,
    E,
    TestHost.TestHost | A11yFocus.FocusTracker | Html.Host | TestClock.TestClock
  >
) => Effect.runPromise(eff.pipe(Effect.provide(playLayer)))

describe("StickToBottom", () => {
  it("follows streaming growth, pauses on scroll up, marks unseen, and resumes at bottom", () => {
    let s = initialStickToBottomState(true)
    const grown1 = onStickContentGrowth(s, { scrollTop: 100, scrollHeight: 400, clientHeight: 200 })
    expect(grown1.shouldScrollToBottom).toBe(true)
    expect(grown1.state).toEqual({ following: true, atBottom: true, unseen: false })

    s = onStickScroll(grown1.state, { scrollTop: 50, scrollHeight: 400, clientHeight: 200 })
    expect(s).toEqual({ following: false, atBottom: false, unseen: false })

    const grown2 = onStickContentGrowth(s, { scrollTop: 50, scrollHeight: 520, clientHeight: 200 })
    expect(grown2.shouldScrollToBottom).toBe(false)
    expect(grown2.state).toEqual({ following: false, atBottom: false, unseen: true })

    const jumped = jumpToBottom()
    expect(jumped).toEqual({
      state: { following: true, atBottom: true, unseen: false },
      shouldScrollToBottom: true
    })
  })
})

describe("TreeChecked tri-state cascade", () => {
  const tree: ReadonlyArray<TreeNode> = [
    {
      value: "src",
      label: "src",
      children: [
        { value: "a", label: "a.ts" },
        { value: "b", label: "b.ts" }
      ]
    },
    { value: "readme", label: "README.md" }
  ]

  it("computes mixed parent state, cascades toggles, and supports leaves/parents/all strategies", () => {
    const partial = computeTreeCheckStates(tree, new Set(["a"]))
    expect(partial.get("src")).toBe("mixed")
    expect(partial.get("a")).toBe(true)
    expect(partial.get("b")).toBe(false)

    const allSrc = toggleTreeNodeCheck(tree, new Set(["a"]), "src")
    expect(Array.from(allSrc).sort()).toEqual(["a", "b"])
    expect(getCheckedByStrategy(tree, allSrc, "parents")).toEqual(["src"])
    expect(getCheckedByStrategy(tree, allSrc, "leaves")).toEqual(["a", "b"])
    expect(getCheckedByStrategy(tree, allSrc, "all")).toEqual(["src", "a", "b"])

    const cleared = toggleTreeNodeCheck(tree, allSrc, "src")
    expect(cleared.size).toBe(0)
  })
})

describe("AsyncOptionsLoader (debounced & fiber-interruptible under TestClock)", () => {
  it("cancels stale queries during debounce and resolves only the latest query", () =>
    Effect.runPromise(
      Effect.gen(function*() {
        const calls: Array<string> = []
        const loader = yield* makeAsyncOptionsLoader<string>({
          debounceMs: 100,
          load: (q) =>
            Effect.sync(() => {
              calls.push(q)
              return [`match:${q}`]
            })
        })

        yield* loader.search("a")
        yield* TestClock.adjust(Duration.millis(50))
        yield* loader.search("ab")
        yield* TestClock.adjust(Duration.millis(120))
        yield* Effect.yieldNow

        const state = yield* loader.get
        expect(calls).toEqual(["ab"])
        expect(state.status).toBe("ready")
        expect(state.items).toEqual(["match:ab"])
      }).pipe(Effect.provide(TestClock.layer()))
    ))
})

const PaginationHostMsg = UiSchema.TaggedEnum({ SetPage: { page: Schema.Finite } })
const PaginationHost = Html.component({
  name: "PaginationHost",
  model: Schema.Struct({ page: Schema.Finite }),
  message: PaginationHostMsg
}).make({
  init: () => ({ page: 1 }),
  update: { SetPage: (_, { page }) => ({ page }) },
  view: (h, model) =>
    Pagination(h, {
      props: { page: model.page, totalPages: 10 },
      onEmit: { PageChanged: ({ page }) => PaginationHostMsg.SetPage({ page }) }
    })
})

describe("Pagination", () => {
  it("builds smart ellipsis windows, navigates pages, and passes SSR purity", () =>
    runPlay(
      Effect.gen(function*() {
        expect(buildPaginationRange({ page: 6, totalPages: 20 })).toEqual([
          1, "ellipsis", 5, 6, 7, "ellipsis", 20
        ])
        yield* checkServer(PaginationHost, {})

        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(PaginationHost, {})
            const prev = HtmlLocator.role("button", { name: "Previous page" })
            const next = HtmlLocator.role("button", { name: "Next page" })
            yield* play.expect(prev).toHaveAttribute("disabled", "")
            yield* play.click(next)
            yield* play.expect(HtmlLocator.role("button", { name: "Page 2" })).toHaveAttribute(
              "aria-current",
              "page"
            )
          })
        )
      })
    ))
})

const TokenHostMsg = UiSchema.TaggedEnum({ Set: { tokens: Schema.Array(Schema.String) } })
const TokenHost = Html.component({
  name: "TokenHost",
  model: Schema.Struct({ tokens: Schema.Array(Schema.String) }),
  message: TokenHostMsg
}).make({
  init: () => ({ tokens: ["effect"] }),
  update: { Set: (_, { tokens }) => ({ tokens: [...tokens] }) },
  view: (h, model) =>
    TokenInput(h, {
      props: { label: "Tags", tokens: model.tokens },
      onEmit: { TokensChanged: ({ tokens }) => TokenHostMsg.Set({ tokens: [...tokens] }) }
    })
})

describe("TokenInput", () => {
  it("parses comma/Enter tokens, deduplicates, and removes via Backspace highlight-then-delete", () =>
    runPlay(
      Effect.gen(function*() {
        expect(parseTokenText("alpha, beta\ngamma")).toEqual(["alpha", "beta", "gamma"])
        expect(addTokens(["Effect"], ["effect", "Bun"])).toEqual(["Effect", "Bun"])
        yield* checkServer(TokenHost, {})

        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(TokenHost, {})
            const input = HtmlLocator.role("textbox", { name: "Tags" })
            yield* play.type(input, "bun,")
            yield* play.expect(HtmlLocator.role("button", { name: "Remove bun" })).toExist()

            // First Backspace highlights last chip; Delete removes it
            yield* play.keydown(input, "Backspace")
            yield* play.keydown(input, "Delete")
            expect(
              HtmlLocator.queryAllByRole(play.root.container, "button", {
                name: "Remove bun"
              })
            ).toHaveLength(0)

            // Rejecting duplicate keeps draft instead of silently wiping it
            yield* play.type(input, "effect")
            yield* play.keydown(input, "Enter")
            yield* play.expect(input).toHaveValue("effect")
          })
        )
      })
    ))
})

const SegHostMsg = UiSchema.TaggedEnum({ Set: { value: Schema.String } })
const SegHost = Html.component({
  name: "SegHost",
  props: Schema.Struct({ dir: Schema.optional(Schema.Literals(["ltr", "rtl"])) }),
  model: Schema.Struct({ value: Schema.String }),
  message: SegHostMsg
}).make({
  init: () => ({ value: "day" }),
  update: { Set: (_, { value }) => ({ value }) },
  view: (h, model) =>
    SegmentedControl(h, {
      props: {
        label: "Range",
        value: model.value,
        dir: h.props.dir,
        options: [
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" }
        ]
      },
      onEmit: { ValueChanged: ({ value }) => SegHostMsg.Set({ value }) }
    })
})

describe("SegmentedControl and sliding indicator geometry", () => {
  it("computes indicator geometry and passes effect-ui-a11y radio-group + LTR/RTL checks", () =>
    runPlay(
      Effect.gen(function*() {
        expect(
          computeIndicatorGeometry(
            { left: 10, top: 0, width: 300, height: 40 },
            { left: 110, top: 0, width: 100, height: 40 }
          )
        ).toEqual({
          offset: 100,
          size: 100,
          cssVars: { "--indicator-offset": "100px", "--indicator-size": "100px" }
        })

        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(SegHost, {})
            yield* checkPattern(play, "radio-group")
          })
        )

        yield* checkDirection(
          (dir) => HtmlPlay.make(SegHost, { dir }),
          "radio-group"
        )
      })
    ))
})

const InlineHostMsg = UiSchema.TaggedEnum({ Saved: { value: Schema.String } })
const InlineHost = Html.component({
  name: "InlineHost",
  model: Schema.Struct({ title: Schema.String }),
  message: InlineHostMsg
}).make({
  init: () => ({ title: "Draft" }),
  update: { Saved: (_, { value }) => ({ title: value }) },
  view: (h, model) =>
    InlineEdit(h, {
      props: { label: "Title", value: model.title },
      onEmit: {
        Committed: ({ value }) => InlineHostMsg.Saved({ value }),
        Cancelled: () => undefined
      }
    })
})

describe("InlineEdit", () => {
  it("enters edit mode on click, reverts on Escape, and commits on Enter", () =>
    runPlay(
      Effect.scoped(
        Effect.gen(function*() {
          const play = yield* HtmlPlay.make(InlineHost, {})
          const btn = HtmlLocator.role("button", { name: "Title: Draft" })
          yield* play.click(btn)

          const input = HtmlLocator.role("textbox", { name: "Title" })
          yield* play.type(input, "Temporary")
          yield* play.keydown(input, "Escape")
          yield* play.expect(HtmlLocator.role("button", { name: "Title: Draft" })).toExist()

          yield* play.click(HtmlLocator.role("button", { name: "Title: Draft" }))
          yield* play.type(HtmlLocator.role("textbox", { name: "Title" }), "Published")
          yield* play.keydown(HtmlLocator.role("textbox", { name: "Title" }), "Enter")
          yield* play.expect(HtmlLocator.role("button", { name: "Title: Published" })).toExist()
        })
      )
    ))
})

const TriggerHostMsg = UiSchema.TaggedEnum({
  Set: { text: Schema.String, caret: Schema.Finite }
})
const TriggerHost = Html.component({
  name: "TriggerHost",
  model: Schema.Struct({ text: Schema.String, caret: Schema.Finite }),
  message: TriggerHostMsg
}).make({
  init: () => ({ text: "Hi @al", caret: 6 }),
  update: { Set: (_, { caret, text }) => ({ text, caret }) },
  view: (h, model) =>
    TriggerMenu(h, {
      props: {
        label: "Composer",
        text: model.text,
        caret: model.caret,
        suggestions: [
          { value: "alice", label: "Alice" },
          { value: "bob", label: "Bob" }
        ]
      },
      onEmit: {
        TextChanged: ({ caret, text }) => TriggerHostMsg.Set({ text, caret }),
        SuggestionApplied: ({ caret, text }) => TriggerHostMsg.Set({ text, caret })
      }
    })
})

describe("TriggerMenu and caret parser", () => {
  it("ignores emails, detects @mentions, and replaces the exact trigger range on Enter", () =>
    runPlay(
      Effect.scoped(
        Effect.gen(function*() {
          expect(detectTrigger("mail a@b.com", 12)).toBeUndefined()
          const match = detectTrigger("hello @ali", 10)
          expect(match).toEqual({ trigger: "@", query: "ali", rangeStart: 6, rangeEnd: 10 })
          if (match === undefined) throw new Error("expected trigger match")
          expect(applyTriggerSelection("hello @ali!", match, "@alice")).toEqual({
            text: "hello @alice !",
            caret: 13
          })

          const play = yield* HtmlPlay.make(TriggerHost, {})
          const input = HtmlLocator.role("combobox", { name: "Composer" })
          yield* play.expect(HtmlLocator.role("option", { name: "Alice" })).toExist()
          yield* play.keydown(input, "Enter")
          yield* play.expect(input).toHaveValue("Hi @alice ")
        })
      )
    ))
})
