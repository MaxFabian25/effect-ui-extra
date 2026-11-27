export type EnterKeyHint =
  | "enter"
  | "done"
  | "go"
  | "next"
  | "previous"
  | "search"
  | "send"

export type InputHintKind =
  | "search"
  | "email"
  | "tel"
  | "url"
  | "one-time-code"
  | "numeric"
  | "decimal"
  | "name"
  | "username"
  | "current-password"
  | "new-password"
  | "postal-code"
  | "message"

export interface InputHintAttrs {
  readonly type?: string | undefined
  readonly inputmode?: string | undefined
  readonly autocomplete?: string | undefined
  readonly enterkeyhint?: EnterKeyHint | undefined
  readonly autocapitalize?: string | undefined
  readonly autocorrect?: string | undefined
  readonly spellcheck?: "true" | "false" | undefined
}

const HINT_PRESETS: Readonly<Record<InputHintKind, InputHintAttrs>> = {
  search: {
    type: "search",
    inputmode: "search",
    enterkeyhint: "search",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: "false"
  },
  email: {
    type: "email",
    inputmode: "email",
    autocomplete: "email",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: "false"
  },
  tel: {
    type: "tel",
    inputmode: "tel",
    autocomplete: "tel",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: "false"
  },
  url: {
    type: "url",
    inputmode: "url",
    autocomplete: "url",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: "false"
  },
  "one-time-code": {
    type: "text",
    inputmode: "numeric",
    autocomplete: "one-time-code",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: "false"
  },
  numeric: {
    type: "text",
    inputmode: "numeric",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: "false"
  },
  decimal: {
    type: "text",
    inputmode: "decimal",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: "false"
  },
  name: {
    type: "text",
    autocomplete: "name",
    autocapitalize: "words",
    spellcheck: "false"
  },
  username: {
    type: "text",
    autocomplete: "username",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: "false"
  },
  "current-password": {
    type: "password",
    autocomplete: "current-password",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: "false"
  },
  "new-password": {
    type: "password",
    autocomplete: "new-password",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: "false"
  },
  "postal-code": {
    type: "text",
    autocomplete: "postal-code",
    autocapitalize: "characters",
    autocorrect: "off",
    spellcheck: "false"
  },
  message: {
    type: "text",
    enterkeyhint: "send",
    autocapitalize: "sentences",
    autocorrect: "on",
    spellcheck: "true"
  }
}

/**
 * Returns HTML attributes (`type`, `inputmode`, `autocomplete`, `enterkeyhint`,
 * `autocapitalize`, `autocorrect`, `spellcheck`) tailored to a semantic field
 * kind so mobile keyboards, autofill, and spellcheck behave idiomatically.
 */
export const inputHints = (
  kind: InputHintKind,
  overrides: Partial<InputHintAttrs> = {}
): Readonly<Record<string, string | undefined>> => {
  const merged = { ...HINT_PRESETS[kind], ...overrides }
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined) out[k] = v
  }
  return out
}
