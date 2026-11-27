import { UiSchema } from "@effect/ui"
import { Html, HtmlServer } from "@effect/ui/html"
import { HtmlLocator, HtmlPlay } from "@effect/ui/html/testing"
import { Locator, TestHost } from "@effect/ui/testing"
import { describe, expect, it } from "bun:test"
import { Effect, Layer, Redacted, Schema } from "effect"
import { TestClock } from "effect/testing"
import { A11yFocus, checkPattern } from "../../src/a11y/index.js"
import { checkServer } from "../../src/page/index.js"
import {
  Command,
  computeListboxRange,
  fuzzyFilter,
  fuzzyMatch,
  Listbox,
  PasswordInput,
  recoverFocusKey,
  Resizable,
  resizePanes,
  Tree,
  type TreeNode
} from "../../src/widgets/index.js"

const playLayer = Layer.mergeAll(
  TestHost.layer(),
  A11yFocus.layer(),
  TestClock.layer()
)

const runPlay = <A, E>(
  eff: Effect.Effect<
    A,
    E,
    TestHost.TestHost | A11yFocus.FocusTracker | Html.Host | TestClock.TestClock
  >
) => Effect.runPromise(eff.pipe(Effect.provide(playLayer)))

// ---------------------------------------------------------------------------
// 1. Fuzzy search & FocusRecovery pure unit tests
// ---------------------------------------------------------------------------

describe("fuzzyMatch, fuzzyFilter, and recoverFocusKey", () => {
  it("ranks exact > prefix > word-start > substring > subsequence and ignores accents", () => {
    const results = fuzzyFilter(
      [
        { id: "subseq", title: "Go to Profile" },
        { id: "word", title: "Open Settings" },
        { id: "exact", title: "Set" },
        { id: "prefix", title: "Settings" },
        { id: "accent", title: "Sétup Café" }
      ],
      "set",
      (i) => i.title
    )
    expect(results.map((r) => r.item.id)).toEqual([
      "exact",
      "prefix",
      "accent",
      "word"
    ])

    const accentMatch = fuzzyMatch("cafe", "Sétup Café")
    expect(accentMatch).toBeDefined()
    expect(accentMatch!.ranges).toEqual([{ start: 6, end: 10 }])

    const subseq = fuzzyMatch("gp", "Git Push")
    expect(subseq).toBeDefined()
    expect(subseq!.ranges).toEqual([
      { start: 0, end: 1 },
      { start: 4, end: 5 }
    ])
  })

  it("recovers focus to surviving parent on branch collapse, then next sibling, then previous sibling", () => {
    const parents: Record<string, string | undefined> = {
      src: undefined,
      "src/a": "src",
      "src/b": "src",
      tests: undefined
    }
    // Branch collapsed while focus was on child -> recovers to parent "src"
    expect(
      recoverFocusKey({
        previousOrder: ["src", "src/a", "src/b", "tests"],
        nextOrder: ["src", "tests"],
        lostKey: "src/b",
        parentOf: (k) => parents[k]
      })
    ).toBe("src")

    // Middle row deleted -> recovers to next surviving sibling
    expect(
      recoverFocusKey({
        previousOrder: ["a", "b", "c"],
        nextOrder: ["a", "c"],
        lostKey: "b"
      })
    ).toBe("c")

    // Last row deleted -> recovers to previous surviving sibling
    expect(
      recoverFocusKey({
        previousOrder: ["a", "b", "c"],
        nextOrder: ["a", "b"],
        lostKey: "c"
      })
    ).toBe("b")
  })
})

// ---------------------------------------------------------------------------
// 2. PasswordInput (Schema.Redacted + zero secret in SSR state)
// ---------------------------------------------------------------------------

const PwHostMsg = UiSchema.TaggedEnum({
  Updated: { value: Schema.RedactedFromValue(Schema.String) }
})
const PasswordHost = Html.component({
  name: "PasswordHost",
  model: Schema.Struct({ secret: Schema.RedactedFromValue(Schema.String) }),
  message: PwHostMsg
}).make({
  init: () => ({ secret: Redacted.make("s3cr3t-pass!") }),
  update: { Updated: (_, { value }) => ({ secret: value }) },
  view: (h, model) =>
    PasswordInput(h, {
      props: {
        id: "account-pw",
        label: "Password",
        value: model.secret
      },
      onEmit: {
        Changed: ({ value }) => PwHostMsg.Updated({ value }),
        ToggledVisibility: () => undefined
      }
    })
})

describe("PasswordInput", () => {
  it("toggles masked/revealed state, emits Redacted values, and keeps PasswordInput SSR state free of raw secret", () =>
    runPlay(
      Effect.gen(function*() {
        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(PasswordHost, {})
            const input = HtmlLocator.label("Password")
            const showBtn = HtmlLocator.role("button", { name: "Show password" })

            yield* play.expect(input).toHaveAttribute("type", "password")
            yield* play.expect(showBtn).toHaveAttribute("aria-pressed", "false")
            yield* play.click(showBtn)

            const hideBtn = HtmlLocator.role("button", { name: "Hide password" })
            yield* play.expect(input).toHaveAttribute("type", "text")
            yield* play.expect(hideBtn).toHaveAttribute("aria-pressed", "true")

            yield* play.type(input, "new-secret-99")
            expect(Redacted.value(play.root.model()!.secret)).toBe("new-secret-99")
          })
        )

        // Direct PasswordInput SSR purity check + confirm SSR state never stores raw secret
        const rendered = yield* checkServer(PasswordInput, {
          id: "ssr-pw",
          label: "Password",
          value: Redacted.make("top-secret-token-xyz")
        })
        const serializedState = HtmlServer.serializeState(rendered.state)
        expect(serializedState).not.toContain("top-secret-token-xyz")
      })
    ))
})

// ---------------------------------------------------------------------------
// 3. Listbox (dogfooding effect-ui-a11y "listbox" + checkServer + Shift-range)
// ---------------------------------------------------------------------------

const ListboxHostMsg = UiSchema.TaggedEnum({
  Selected: { values: Schema.Array(Schema.String) },
  RemovedSecond: {}
})
const ListboxHost = Html.component({
  name: "ListboxHost",
  model: Schema.Struct({
    selected: Schema.Array(Schema.String),
    items: Schema.Array(
      Schema.Struct({
        value: Schema.String,
        label: Schema.String,
        disabled: Schema.optional(Schema.Boolean)
      })
    )
  }),
  message: ListboxHostMsg
}).make({
  init: () => ({
    selected: ["alpha"],
    items: [
      { value: "alpha", label: "Alpha" },
      { value: "beta", label: "Beta" },
      { value: "gamma", label: "Gamma", disabled: true },
      { value: "delta", label: "Delta" }
    ]
  }),
  update: {
    Selected: ($, { values }) => $.evolve({ selected: values }),
    RemovedSecond: ($) =>
      $.evolve({ items: $.model.items.filter((i) => i.value !== "beta") })
  },
  view: (h, model) =>
    h.div(
      Listbox(h, {
        props: {
          label: "Regions",
          items: model.items,
          selected: model.selected,
          selectionMode: "multiple"
        },
        onEmit: {
          Selected: ({ values }) => ListboxHostMsg.Selected({ values })
        }
      }),
      h.button
        .attrs({ type: "button" })
        .on("click", ListboxHostMsg.RemovedSecond())
        .children("Remove Beta")
    )
})

describe("Listbox", () => {
  it("passes effect-ui-a11y listbox check, Shift+Arrow range selection, Ctrl+A, and checkServer", () =>
    runPlay(
      Effect.gen(function*() {
        expect(
          computeListboxRange(
            [
              { value: "a", label: "A" },
              { value: "b", label: "B", disabled: true },
              { value: "c", label: "C" }
            ],
            "a",
            "c"
          )
        ).toEqual(["a", "c"])

        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(ListboxHost, {})
            // Live WAI-ARIA APG audit via effect-ui-a11y!
            yield* checkPattern(play, "listbox")

            // Shift+ArrowDown extends contiguous range skipping disabled "gamma"
            const optAlpha = HtmlLocator.role("option", { name: "Alpha" })
            yield* play.keydown(optAlpha, "ArrowDown", { shift: true })
            expect(play.root.model()!.selected).toEqual(["alpha", "beta"])

            const optBeta = HtmlLocator.role("option", { name: "Beta" })
            yield* play.keydown(optBeta, "ArrowDown", { shift: true })
            expect(play.root.model()!.selected).toEqual(["alpha", "beta", "delta"])

            // Delete focused "beta" -> FocusRecovery moves tab stop to surviving "delta"
            yield* play.click(HtmlLocator.role("button", { name: "Remove Beta" }))
            const optDelta = HtmlLocator.role("option", { name: "Delta" })
            yield* play.expect(optDelta).toHaveAttribute("tabindex", "0")
          })
        )

        yield* checkServer(ListboxHost, {})
      })
    ))
})

// ---------------------------------------------------------------------------
// 4. Tree (dogfooding effect-ui-a11y "tree" + FocusRecovery + checkServer)
// ---------------------------------------------------------------------------

const sampleTree: ReadonlyArray<TreeNode> = [
  {
    value: "src",
    label: "src",
    children: [
      { value: "src/index.ts", label: "index.ts" },
      { value: "src/tree.ts", label: "tree.ts" }
    ]
  },
  {
    value: "tests",
    label: "tests",
    children: [{ value: "tests/app.test.ts", label: "app.test.ts" }]
  },
  { value: "readme", label: "README.md" }
]

const TreeHostMsg = UiSchema.TaggedEnum({
  Expanded: { expanded: Schema.Array(Schema.String) },
  Selected: { value: Schema.String }
})
const TreeHost = Html.component({
  name: "TreeHost",
  model: Schema.Struct({
    expanded: Schema.Array(Schema.String),
    selected: Schema.NullOr(Schema.String)
  }),
  message: TreeHostMsg
}).make({
  init: () => ({ expanded: [], selected: null }),
  update: {
    Expanded: ($, { expanded }) => $.evolve({ expanded }),
    Selected: ($, { value }) => $.evolve({ selected: value })
  },
  view: (h, model) =>
    Tree(h, {
      props: {
        label: "Workspace files",
        nodes: [...sampleTree],
        expanded: model.expanded,
        selected: model.selected
      },
      onEmit: {
        ToggledExpand: ({ expanded }) => TreeHostMsg.Expanded({ expanded }),
        Selected: ({ value }) => TreeHostMsg.Selected({ value })
      }
    })
})

describe("Tree", () => {
  it("passes effect-ui-a11y tree check, ArrowRight/ArrowLeft expand/collapse, '*' expand siblings, and checkServer", () =>
    runPlay(
      Effect.gen(function*() {
        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(TreeHost, {})
            // Live WAI-ARIA APG audit via effect-ui-a11y!
            yield* checkPattern(play, "tree")

            const srcItem = HtmlLocator.role("treeitem", { name: "src" })
            // ArrowRight on collapsed branch expands it
            yield* play.keydown(srcItem, "ArrowRight")
            expect(play.root.model()!.expanded).toEqual(["src"])
            yield* play
              .expect(HtmlLocator.role("treeitem", { name: "index.ts" }))
              .toExist()

            // ArrowRight on expanded branch moves focus to first child
            yield* play.keydown(srcItem, "ArrowRight")
            const indexItem = HtmlLocator.role("treeitem", { name: "index.ts" })
            yield* play.expect(indexItem).toHaveAttribute("tabindex", "0")

            // ArrowLeft on leaf moves focus to parent "src"
            yield* play.keydown(indexItem, "ArrowLeft")
            yield* play.expect(srcItem).toHaveAttribute("tabindex", "0")

            // ArrowLeft on expanded branch collapses it
            yield* play.keydown(srcItem, "ArrowLeft")
            expect(play.root.model()!.expanded).toEqual([])

            // '*' expands all sibling branches
            yield* play.keydown(srcItem, "*")
            expect(play.root.model()!.expanded).toEqual(["src", "tests"])
          })
        )

        yield* checkServer(TreeHost, {})
      })
    ))
})

// ---------------------------------------------------------------------------
// 5. Resizable split panes
// ---------------------------------------------------------------------------

const ResizableHostMsg = UiSchema.TaggedEnum({
  Resized: { sizes: Schema.Array(Schema.Number) }
})
const ResizableHost = Html.component({
  name: "ResizableHost",
  model: Schema.Array(Schema.Number),
  message: ResizableHostMsg
}).make({
  init: () => [30, 70],
  update: { Resized: (_, { sizes }) => sizes },
  view: (h, sizes) =>
    Resizable(h, {
      props: {
        sizes,
        step: 5,
        largeStep: 15,
        panes: [
          { id: "sidebar", label: "Sidebar", minSize: 15, maxSize: 60, collapsible: true },
          { id: "main", label: "Editor", minSize: 40, maxSize: 85 }
        ]
      },
      onEmit: { Resized: ({ sizes: next }) => ResizableHostMsg.Resized({ sizes: next }) }
    })
})

describe("Resizable", () => {
  it("enforces min/max constraints, keyboard Arrow/Shift+Arrow/Home/End/Enter collapse, and checkServer", () =>
    runPlay(
      Effect.gen(function*() {
        expect(
          resizePanes(
            [30, 70],
            [
              { id: "a", label: "A", minSize: 20, maxSize: 50 },
              { id: "b", label: "B", minSize: 50, maxSize: 80 }
            ],
            0,
            100
          )
        ).toEqual([50, 50])

        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(ResizableHost, {})
            const sep = HtmlLocator.role("separator", { name: "Resize Sidebar" })

            yield* play.expect(sep).toHaveAttribute("aria-orientation", "vertical")
            yield* play.expect(sep).toHaveAttribute("aria-valuenow", "30")

            yield* play.keydown(sep, "ArrowRight")
            expect(play.root.model()).toEqual([35, 65])

            yield* play.keydown(sep, "ArrowRight", { shift: true })
            expect(play.root.model()).toEqual([50, 50])

            yield* play.keydown(sep, "End")
            expect(play.root.model()).toEqual([60, 40])

            yield* play.keydown(sep, "Home")
            expect(play.root.model()).toEqual([15, 85])

            // Enter collapses collapsible sidebar to 0 and Enter again restores to 15
            yield* play.keydown(sep, "Enter")
            expect(play.root.model()).toEqual([0, 100])
            yield* play.keydown(sep, "Enter")
            expect(play.root.model()).toEqual([15, 85])
          })
        )

        yield* checkServer(ResizableHost, {})
      })
    ))
})

// ---------------------------------------------------------------------------
// 6. Command palette (dogfooding effect-ui-a11y "combobox" + fuzzy + checkServer)
// ---------------------------------------------------------------------------

const CmdHostMsg = UiSchema.TaggedEnum({
  Opened: {},
  Closed: {},
  Ran: { value: Schema.String }
})
const CommandHost = Html.component({
  name: "CommandHost",
  model: Schema.Struct({
    open: Schema.Boolean,
    lastRan: Schema.NullOr(Schema.String)
  }),
  message: CmdHostMsg
}).make({
  init: () => ({ open: false, lastRan: null }),
  update: {
    Opened: ($) => $.evolve({ open: true }),
    Closed: ($) => $.evolve({ open: false }),
    Ran: ($, { value }) => $.evolve({ lastRan: value })
  },
  view: (h, model) =>
    Command(h, {
      props: {
        open: model.open,
        label: "Command palette",
        placeholder: "Type a command...",
        items: [
          { value: "git-push", label: "Git Push", group: "Git", shortcut: "⌘⇧P" },
          { value: "open-settings", label: "Open Settings", group: "App", keywords: ["preferences"] },
          { value: "toggle-theme", label: "Toggle Dark Theme", group: "App" }
        ]
      },
      onEmit: {
        RequestedOpen: () => CmdHostMsg.Opened(),
        RequestedClose: () => CmdHostMsg.Closed(),
        Selected: ({ value }) => CmdHostMsg.Ran({ value })
      }
    })
})

describe("Command", () => {
  it("passes effect-ui-a11y combobox check, fuzzy filters with <mark> highlights, executes on Enter, and passes checkServer", () =>
    runPlay(
      Effect.gen(function*() {
        yield* Effect.scoped(
          Effect.gen(function*() {
            const play = yield* HtmlPlay.make(CommandHost, {})
            // Live WAI-ARIA APG combobox audit via effect-ui-a11y!
            yield* checkPattern(play, "combobox")

            const input = HtmlLocator.role("combobox", { name: "Command palette" })
            yield* play.keydown(input, "ArrowDown")
            yield* play.type(input, "gp")
            // "gp" fuzzy-matches "Git Push" and highlights G and P with <mark>
            expect(play.root.all(Locator.tag("mark")).length).toBe(2)

            yield* play.keydown(input, "Enter")
            expect(play.root.model()!.lastRan).toBe("git-push")
            expect(play.root.model()!.open).toBe(false)
          })
        )

        yield* checkServer(CommandHost, {})
      })
    ))
})
