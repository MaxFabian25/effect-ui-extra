import type { RegistryItem } from "../schema.js"

/**
 * AI conversation components (`message`, `code-block`, `trace`, `attachment`,
 * `questionnaire`, `marker`) plus full multi-component page blocks
 * (`block-dashboard`, `block-auth`, `block-ai-chat`).
 */
export const AI_AND_BLOCK_REGISTRY_ITEMS: ReadonlyArray<RegistryItem> = [
  {
    name: "message",
    title: "Message & Bubble",
    category: "ai",
    description: "Structured user and assistant message bubbles with avatar, metadata header, and footer.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "message.ts",
        content: `import type { View } from "@effect/ui"
import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export type MessageRole = "user" | "assistant" | "system"

export const messageBubble = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly role: MessageRole
    readonly author: string
    readonly timestamp?: string | undefined
    readonly body: View.Content<Msg> | string
    readonly footer?: View.Content<Msg> | string | undefined
    readonly className?: string | undefined
  }
) => {
  const isUser = options.role === "user"
  return h.article
    .attrs({ "data-message-role": options.role })
    .class(cn("flex flex-col gap-1", isUser ? "items-end" : "items-start", options.className))
    .children(
      h.header.class("flex items-center gap-2 text-xs text-muted-foreground").children(
        h.span.class("font-medium text-foreground").children(options.author),
        ...(options.timestamp !== undefined ? [h.time.children(options.timestamp)] : [])
      ),
      h.div
        .class(
          cn(
            "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-surface text-foreground"
          )
        )
        .children(options.body),
      ...(options.footer !== undefined
        ? [h.footer.class("flex items-center gap-2 text-xs text-muted-foreground").children(options.footer)]
        : [])
    )
}
`
      }
    ]
  },
  {
    name: "code-block",
    title: "Code Block",
    category: "ai",
    description: "Copyable syntax-ready code block with language label, line numbers, and TestClock copy feedback.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui", "effect"],
    files: [
      {
        path: "codeBlock.ts",
        content: `import { Command, UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { cn } from "./cn.js"

export const CodeBlockProps = Schema.Struct({
  code: Schema.String,
  language: Schema.optional(Schema.String),
  title: Schema.optional(Schema.String),
  showLineNumbers: Schema.optional(Schema.Boolean)
})
export type CodeBlockProps = typeof CodeBlockProps.Type

const CodeBlockMsg = UiSchema.TaggedEnum({
  CopyClicked: {},
  ResetCopied: {}
})

const copyAndReset = Command.make(
  "CodeBlockCopy",
  { args: { text: Schema.String } },
  ({ text }) =>
    Effect.gen(function*() {
      if (typeof navigator !== "undefined" && navigator.clipboard !== undefined) {
        yield* Effect.tryPromise(() => navigator.clipboard.writeText(text)).pipe(Effect.ignore)
      }
      yield* Effect.sleep(Duration.millis(1500))
      return CodeBlockMsg.ResetCopied()
    })
)

export const CodeBlock = Html.component({
  name: "CodeBlock",
  props: CodeBlockProps,
  model: Schema.Struct({ copied: Schema.Boolean }),
  message: CodeBlockMsg
}).make({
  init: () => ({ copied: false }),
  update: {
    CopyClicked: ($) =>
      $.evolve({ copied: true }).run(copyAndReset.make({ text: $.props.code })),
    ResetCopied: ($) => $.evolve({ copied: false })
  },
  view: (h, model) => {
    const p = h.props
    const lines = p.code.split("\\n")
    return h.div
      .attrs({ "data-code-block": "" })
      .class("overflow-hidden rounded-lg border border-border bg-surface text-foreground")
      .children(
        h.div.class("flex items-center justify-between gap-2 border-b border-border bg-muted/60 px-3 py-1.5 text-xs").children(
          h.span.class("font-mono text-muted-foreground").children(p.title ?? p.language ?? "code"),
          h.button
            .attrs({
              type: "button",
              "aria-label": model.copied ? "Copied code" : "Copy code"
            })
            .class(
              cn(
                "rounded-sm px-2 py-0.5 text-xs font-medium transition-colors",
                model.copied
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            )
            .on("click", () => CodeBlockMsg.CopyClicked())
            .children(model.copied ? "Copied" : "Copy")
        ),
        h.pre.class("overflow-x-auto p-3 font-mono text-xs leading-relaxed").children(
          h.code.children(
            ...lines.map((line, idx) =>
              h.span
                .key(\`line-\${idx}\`)
                .class("block")
                .children(
                  ...(p.showLineNumbers === true
                    ? [
                        h.span
                          .attrs({ "aria-hidden": "true" })
                          .class("mr-4 inline-block w-6 select-none text-right text-muted-foreground/60")
                          .children(String(idx + 1))
                      ]
                    : []),
                  line.length === 0 ? " " : line
                )
            )
          )
        )
      )
  }
})
`
      }
    ]
  },
  {
    name: "trace",
    title: "Agent Trace",
    category: "ai",
    description: "Collapsible agent reasoning and tool-call trace list with status indicators and durations.",
    registryDependencies: ["cn", "badge"],
    dependencies: ["@effect/ui", "effect"],
    files: [
      {
        path: "trace.ts",
        content: `import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { badge } from "./badge.js"
import { cn } from "./cn.js"

export const TraceStepSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  status: Schema.Literals(["running", "done", "error"]),
  durationMs: Schema.optional(Schema.Number),
  detail: Schema.optional(Schema.String)
})
export type TraceStep = typeof TraceStepSchema.Type

export const TraceProps = Schema.Struct({
  label: Schema.String,
  steps: Schema.Array(TraceStepSchema),
  defaultOpen: Schema.optional(Schema.Boolean)
})
export type TraceProps = typeof TraceProps.Type

const TraceMsg = UiSchema.TaggedEnum({ Toggle: {} })

export const Trace = Html.component({
  name: "Trace",
  props: TraceProps,
  model: Schema.Struct({ open: Schema.Boolean }),
  message: TraceMsg
}).make({
  init: ($) => ({ open: $.props.defaultOpen ?? false }),
  update: {
    Toggle: ($) => $.evolve({ open: !$.model.open })
  },
  view: (h, model) => {
    const p = h.props
    return h.section
      .attrs({ "aria-label": p.label, "data-trace": "", "data-open": String(model.open) })
      .class("rounded-md border border-border bg-surface text-sm")
      .children(
        h.button
          .attrs({
            type: "button",
            "aria-expanded": String(model.open)
          })
          .class("flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-medium hover:bg-muted/50")
          .on("click", () => TraceMsg.Toggle())
          .children(
            h.span.children(\`\${p.label} (\${p.steps.length})\`),
            h.span.class("text-xs text-muted-foreground").children(model.open ? "Hide" : "Show")
          ),
        ...(model.open
          ? [
              h.ol
                .class("space-y-2 border-t border-border px-3 py-2.5")
                .children(
                  ...p.steps.map((step) =>
                    h.li
                      .key(step.id)
                      .class("flex flex-col gap-1 border-l-2 border-border pl-3")
                      .children(
                        h.div.class("flex items-center justify-between gap-2").children(
                          h.span.class("font-medium text-foreground").children(step.title),
                          h.div.class("flex items-center gap-1.5").children(
                            ...(step.durationMs !== undefined
                              ? [h.span.class("font-mono text-xs text-muted-foreground").children(\`\${step.durationMs}ms\`)]
                              : []),
                            badge(h, step.status, {
                              variant:
                                step.status === "error"
                                  ? "destructive"
                                  : step.status === "running"
                                    ? "default"
                                    : "secondary"
                            })
                          )
                        ),
                        ...(step.detail !== undefined
                          ? [
                              h.p
                                .class(cn("text-xs text-muted-foreground", "whitespace-pre-wrap"))
                                .children(step.detail)
                            ]
                          : [])
                      )
                  )
                )
            ]
          : [])
      )
  }
})
`
      }
    ]
  },
  {
    name: "attachment",
    title: "Attachment",
    category: "ai",
    description: "Compact file and media attachment chip with filename, size metadata, and remove action.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "attachment.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const attachmentCard = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly name: string
    readonly meta?: string | undefined
    readonly onRemove?: Msg | undefined
    readonly className?: string | undefined
  }
) =>
  h.div
    .attrs({ "data-attachment": "" })
    .class(
      cn(
        "inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground",
        options.className
      )
    )
    .children(
      h.div.class("min-w-0").children(
        h.div.class("truncate font-medium").children(options.name),
        ...(options.meta !== undefined
          ? [h.div.class("text-[11px] text-muted-foreground").children(options.meta)]
          : [])
      ),
      ...(options.onRemove !== undefined
        ? [
            h.button
              .attrs({ type: "button", "aria-label": \`Remove \${options.name}\` })
              .class("rounded-sm px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground")
              .on("click", () => options.onRemove)
              .children("x")
          ]
        : [])
    )
`
      }
    ]
  },
  {
    name: "questionnaire",
    title: "Questionnaire",
    category: "ai",
    description: "Multi-step structured agent prompt and user decision flow with progress, choices, validation, and submit.",
    registryDependencies: ["cn", "button"],
    dependencies: ["@effect/ui", "effect"],
    files: [
      {
        path: "questionnaire.ts",
        content: `import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { buttonClass } from "./button.js"
import { cn } from "./cn.js"

export const QuestionChoiceSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  description: Schema.optional(Schema.String)
})

export const QuestionItemSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.optional(Schema.String),
  required: Schema.optional(Schema.Boolean),
  choices: Schema.Array(QuestionChoiceSchema)
})
export type QuestionItem = typeof QuestionItemSchema.Type

export const QuestionnaireProps = Schema.Struct({
  label: Schema.String,
  questions: Schema.Array(QuestionItemSchema)
})
export type QuestionnaireProps = typeof QuestionnaireProps.Type

export const QuestionnaireEvents = UiSchema.TaggedEnum({
  Submitted: { answers: Schema.Record(Schema.String, Schema.String) }
})
export type QuestionnaireEvents = typeof QuestionnaireEvents.Type

const QuestionnaireMsg = UiSchema.TaggedEnum({
  SelectChoice: { questionId: Schema.String, choiceId: Schema.String },
  Previous: {},
  Next: {}
})

export const Questionnaire = Html.component({
  name: "Questionnaire",
  props: QuestionnaireProps,
  model: Schema.Struct({
    step: Schema.Number,
    answers: Schema.Record(Schema.String, Schema.String),
    error: Schema.NullOr(Schema.String)
  }),
  message: QuestionnaireMsg,
  events: QuestionnaireEvents
}).make({
  init: () => ({ step: 0, answers: {}, error: null }),
  update: {
    SelectChoice: ($, { questionId, choiceId }) =>
      $.evolve({
        answers: { ...$.model.answers, [questionId]: choiceId },
        error: null
      }),
    Previous: ($) =>
      $.evolve({ step: Math.max(0, $.model.step - 1), error: null }),
    Next: ($) => {
      const current = $.props.questions[$.model.step]
      if (current === undefined) return $.model
      if (current.required !== false && $.model.answers[current.id] === undefined) {
        return $.evolve({ error: "Select an option to continue." })
      }
      if ($.model.step + 1 >= $.props.questions.length) {
        return $.evolve({ error: null }).emit(
          QuestionnaireEvents.Submitted({ answers: $.model.answers })
        )
      }
      return $.evolve({ step: $.model.step + 1, error: null })
    }
  },
  view: (h, model) => {
    const p = h.props
    const total = p.questions.length
    const current = p.questions[model.step]
    if (current === undefined) return h.div.children("No questions.")
    const selected = model.answers[current.id]
    const isLast = model.step + 1 >= total

    return h.section
      .attrs({ "aria-label": p.label, "data-questionnaire": "" })
      .class("rounded-lg border border-border bg-surface p-5 text-foreground")
      .children(
        h.div.class("mb-3 flex items-center justify-between text-xs text-muted-foreground").children(
          h.span.children(\`Question \${model.step + 1} of \${total}\`),
          h.span.children(\`\${Math.round(((model.step + 1) / Math.max(1, total)) * 100)}%\`)
        ),
        h.h3.class("text-base font-semibold").children(current.title),
        ...(current.description !== undefined
          ? [h.p.class("mt-1 text-sm text-muted-foreground").children(current.description)]
          : []),
        h.div
          .attrs({ role: "radiogroup", "aria-label": current.title })
          .class("mt-4 flex flex-col gap-2")
          .children(
            ...current.choices.map((choice) => {
              const checked = selected === choice.id
              return h.button
                .key(choice.id)
                .attrs({
                  type: "button",
                  role: "radio",
                  "aria-checked": String(checked)
                })
                .class(
                  cn(
                    "flex flex-col items-start rounded-md border px-3.5 py-2.5 text-left text-sm transition-colors",
                    checked
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-background hover:bg-muted"
                  )
                )
                .on("click", () =>
                  QuestionnaireMsg.SelectChoice({ questionId: current.id, choiceId: choice.id })
                )
                .children(
                  h.span.class("font-medium").children(choice.label),
                  ...(choice.description !== undefined
                    ? [h.span.class("text-xs text-muted-foreground").children(choice.description)]
                    : [])
                )
            })
          ),
        ...(model.error !== null
          ? [h.p.attrs({ role: "alert" }).class("mt-3 text-xs text-destructive").children(model.error)]
          : []),
        h.div.class("mt-5 flex items-center justify-between gap-2").children(
          h.button
            .attrs({
              type: "button",
              ...(model.step === 0 ? { disabled: "" } : {})
            })
            .class(buttonClass({ variant: "outline", size: "sm" }))
            .on("click", () => QuestionnaireMsg.Previous())
            .children("Back"),
          h.button
            .attrs({ type: "button" })
            .class(buttonClass({ variant: "default", size: "sm" }))
            .on("click", () => QuestionnaireMsg.Next())
            .children(isLast ? "Submit" : "Next")
        )
      )
  }
})
`
      }
    ]
  },
  {
    name: "marker",
    title: "Citation Marker",
    category: "ai",
    description: "Inline source citation marker badge linking answer claims back to references.",
    registryDependencies: ["cn"],
    dependencies: ["@effect/ui"],
    files: [
      {
        path: "marker.ts",
        content: `import type { Html } from "@effect/ui/html"
import { cn } from "./cn.js"

export const citationMarker = <Msg>(
  h: Html.H<Msg>,
  options: {
    readonly index: number
    readonly label: string
    readonly href?: string | undefined
    readonly className?: string | undefined
  }
) => {
  const cls = cn(
    "inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 align-super font-mono text-[10px] font-semibold text-accent-foreground",
    options.className
  )
  if (options.href !== undefined) {
    return h.a
      .class(cls)
      .attrs({ href: options.href, "aria-label": options.label, title: options.label })
      .children(String(options.index))
  }
  return h.span
    .class(cls)
    .attrs({ "aria-label": options.label, title: options.label })
    .children(String(options.index))
}
`
      }
    ]
  },
  {
    name: "block-dashboard",
    title: "Dashboard Block",
    category: "blocks",
    description: "Full SaaS dashboard screen composing Sidebar, KPI Cards, Chart, and DataTable.",
    registryDependencies: ["sidebar", "card", "chart", "data-table"],
    dependencies: ["@effect/ui", "effect", "effect-ui-extra"],
    files: [
      {
        path: "blocks/dashboard.ts",
        content: `import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { card, cardContent, cardHeader, cardTitle } from "../card.js"
import { barChartCard } from "../chart.js"
import { DataTable } from "../dataTable.js"
import { Sidebar } from "../sidebar.js"

const DashboardMsg = UiSchema.TaggedEnum({
  NavSelected: { id: Schema.String }
})

export const DashboardBlock = Html.component({
  name: "DashboardBlock",
  model: Schema.Struct({ activeNav: Schema.String }),
  message: DashboardMsg
}).make({
  init: () => ({ activeNav: "overview" }),
  update: {
    NavSelected: ($, { id }) => $.evolve({ activeNav: id })
  },
  view: (h, model) =>
    h.div.class("flex min-h-screen bg-background text-foreground").children(
      Sidebar(h, {
        props: {
          title: "Workspace",
          activeId: model.activeNav,
          groups: [
            {
              label: "Main",
              items: [
                { id: "overview", label: "Overview", href: "#overview" },
                { id: "ledger", label: "Ledger", href: "#ledger", badge: "12" }
              ]
            }
          ]
        },
        onEmit: {
          Selected: ({ id }) => DashboardMsg.NavSelected({ id }),
          Toggled: () => undefined
        }
      }),
      h.main.class("flex-1 space-y-6 p-6").children(
        h.div.class("grid gap-4 md:grid-cols-3").children(
          card(h).children(cardHeader(h).children(cardTitle(h, "Active users")), cardContent(h).children(h.div.class("text-2xl font-bold").children("1,284"))),
          card(h).children(cardHeader(h).children(cardTitle(h, "Monthly revenue")), cardContent(h).children(h.div.class("text-2xl font-bold").children("$48,920"))),
          card(h).children(cardHeader(h).children(cardTitle(h, "Error rate")), cardContent(h).children(h.div.class("text-2xl font-bold").children("0.12%")))
        ),
        barChartCard(h, {
          title: "Weekly throughput",
          series: [
            {
              id: "requests",
              label: "Requests",
              points: [
                { label: "Mon", value: 42 },
                { label: "Tue", value: 58 },
                { label: "Wed", value: 73 },
                { label: "Thu", value: 64 },
                { label: "Fri", value: 89 }
              ]
            }
          ]
        }),
        DataTable(h, {
          props: {
            label: "Recent activity",
            selectable: true,
            columns: [
              { key: "name", header: "Customer" },
              { key: "status", header: "Status" },
              { key: "amount", header: "Amount" }
            ],
            rows: [
              { id: "r1", cells: { name: "Acme", status: "Paid", amount: "$420" } },
              { id: "r2", cells: { name: "Northwind", status: "Pending", amount: "$190" } }
            ]
          }
        })
      )
    )
})
`
      }
    ]
  },
  {
    name: "block-auth",
    title: "Auth Sign-In Block",
    category: "blocks",
    description: "Accessible sign-in card with redacted PasswordInput, Alert error feedback, and styled Button.",
    registryDependencies: ["card", "button", "alert"],
    dependencies: ["@effect/ui", "effect", "effect-ui-extra"],
    files: [
      {
        path: "blocks/auth.ts",
        content: `import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import { PasswordInput } from "effect-ui-extra/widgets"
import { alertBox } from "../alert.js"
import { styledButton } from "../button.js"
import { card, cardContent, cardDescription, cardHeader, cardTitle } from "../card.js"

const AuthMsg = UiSchema.TaggedEnum({
  EmailChanged: { value: Schema.String },
  PasswordChanged: { value: Schema.Redacted(Schema.String) },
  Submitted: {}
})

export const AuthBlock = Html.component({
  name: "AuthBlock",
  model: Schema.Struct({
    email: Schema.String,
    password: Schema.Redacted(Schema.String),
    error: Schema.NullOr(Schema.String)
  }),
  message: AuthMsg
}).make({
  init: () => ({ email: "", password: Redacted.make(""), error: null }),
  update: {
    EmailChanged: ($, { value }) => $.evolve({ email: value, error: null }),
    PasswordChanged: ($, { value }) =>
      $.evolve({ password: value, error: null }),
    Submitted: ($) => {
      if (!$.model.email.includes("@") || Redacted.value($.model.password).length === 0) {
        return $.evolve({ error: "Enter a valid email and password." })
      }
      return $.evolve({ error: null })
    }
  },
  view: (h, model) =>
    h.div.class("flex min-h-screen items-center justify-center bg-background p-6").children(
      card(h, "w-full max-w-sm").children(
        cardHeader(h).children(
          cardTitle(h, "Sign in"),
          cardDescription(h, "Use your workspace credentials to continue.")
        ),
        cardContent(h).children(
          h.form
            .class("space-y-4")
            .on("submit", () => AuthMsg.Submitted(), { preventDefault: true })
            .children(
              ...(model.error !== null
                ? [alertBox(h, { title: "Sign-in error", description: model.error, variant: "destructive" })]
                : []),
              h.div.class("space-y-1").children(
                h.label.attrs({ for: "auth-email" }).class("text-sm font-medium").children("Email"),
                h.input
                  .attrs({ id: "auth-email", type: "email", autocomplete: "email" })
                  .class("h-9 w-full rounded-md border border-input bg-background px-3 text-sm")
                  .value(model.email)
                  .on("input", ({ value }) => AuthMsg.EmailChanged({ value }))
              ),
              PasswordInput(h, {
                props: {
                  id: "auth-password",
                  label: "Password",
                  value: model.password,
                  autocomplete: "current-password"
                },
                onEmit: {
                  Changed: ({ value }) => AuthMsg.PasswordChanged({ value }),
                  ToggledVisibility: () => undefined
                }
              }),
              styledButton(h, { type: "submit", className: "w-full" }).children("Sign in")
            )
        )
      )
    )
})
`
      }
    ]
  },
  {
    name: "block-ai-chat",
    title: "AI Chat Workspace Block",
    category: "blocks",
    description: "Complete AI assistant thread combining Message bubbles, Trace, CodeBlock, Attachment, and prompt input.",
    registryDependencies: ["message", "trace", "code-block", "attachment", "button"],
    dependencies: ["@effect/ui", "effect"],
    files: [
      {
        path: "blocks/aiChat.ts",
        content: `import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import * as Schema from "effect/Schema"
import { attachmentCard } from "../attachment.js"
import { styledButton } from "../button.js"
import { CodeBlock } from "../codeBlock.js"
import { messageBubble } from "../message.js"
import { Trace } from "../trace.js"

const ChatEntrySchema = Schema.Struct({
  id: Schema.String,
  role: Schema.Literals(["user", "assistant"]),
  text: Schema.String
})

const ChatMsg = UiSchema.TaggedEnum({
  DraftChanged: { value: Schema.String },
  Sent: {}
})

export const AiChatBlock = Html.component({
  name: "AiChatBlock",
  model: Schema.Struct({
    draft: Schema.String,
    entries: Schema.Array(ChatEntrySchema)
  }),
  message: ChatMsg
}).make({
  init: () => ({
    draft: "",
    entries: [
      { id: "m1", role: "user", text: "Check our latest build status." },
      { id: "m2", role: "assistant", text: "All 114 tests passed in 8.8s." }
    ]
  }),
  update: {
    DraftChanged: ($, { value }) => $.evolve({ draft: value }),
    Sent: ($) => {
      const text = $.model.draft.trim()
      if (text.length === 0) return $.model
      return $.evolve({
        draft: "",
        entries: [...$.model.entries, { id: \`m\${$.model.entries.length + 1}\`, role: "user", text }]
      })
    }
  },
  view: (h, model) =>
    h.div.class("mx-auto flex max-w-2xl flex-col gap-4 p-6").children(
      Trace(h, {
        props: {
          label: "Tool execution",
          steps: [{ id: "s1", title: "bun run verify", status: "done", durationMs: 8840 }]
        }
      }),
      ...model.entries.map((entry) =>
        messageBubble(h, {
          role: entry.role,
          author: entry.role === "user" ? "You" : "Assistant",
          body: entry.text
        })
      ),
      CodeBlock(h, {
        props: {
          language: "bash",
          code: "bun run verify",
          showLineNumbers: true
        }
      }),
      h.div.class("flex flex-wrap gap-2").children(
        attachmentCard(h, { name: "verify.log", meta: "1.4 KB" })
      ),
      h.form
        .class("flex gap-2")
        .on("submit", () => ChatMsg.Sent(), { preventDefault: true })
        .children(
          h.input
            .attrs({ type: "text", "aria-label": "Message assistant", placeholder: "Ask a follow-up..." })
            .class("h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm")
            .value(model.draft)
            .on("input", ({ value }) => ChatMsg.DraftChanged({ value })),
          styledButton(h, { type: "submit" }).children("Send")
        )
    )
})
`
      }
    ]
  }
]
