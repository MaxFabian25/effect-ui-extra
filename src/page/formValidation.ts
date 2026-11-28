export type ValidationMode = "onSubmit" | "onBlur" | "onChange"

export interface FieldValidationEntry {
  readonly touched: boolean
  readonly dirty: boolean
  readonly hasShownError: boolean
  readonly clientError: string | null
  readonly serverError: string | null
}

export interface FormValidationState {
  readonly mode: ValidationMode
  readonly submitted: boolean
  readonly fields: Readonly<Record<string, FieldValidationEntry>>
}

export type FormValidationEvent =
  | { readonly _tag: "Changed"; readonly name: string; readonly clientError: string | null }
  | { readonly _tag: "Blurred"; readonly name: string; readonly clientError: string | null }
  | { readonly _tag: "Submitted"; readonly clientErrors: Readonly<Record<string, string | null>> }
  | { readonly _tag: "ServerErrorsReceived"; readonly errors: Readonly<Record<string, string | null>> }
  | { readonly _tag: "Reset" }

export const initialFormValidationState = (
  mode: ValidationMode = "onBlur"
): FormValidationState => ({
  mode,
  submitted: false,
  fields: {}
})

const emptyField = (): FieldValidationEntry => ({
  touched: false,
  dirty: false,
  hasShownError: false,
  clientError: null,
  serverError: null
})

/**
 * Pure Effect-friendly form validation state machine implementing Base UI's
 * `validationMode` (`"onSubmit" | "onBlur" | "onChange"`) plus server-error
 * ingestion and automatic clearing when the user edits a rejected field.
 */
export const reduceFormValidation = (
  state: FormValidationState,
  event: FormValidationEvent
): FormValidationState => {
  switch (event._tag) {
    case "Changed": {
      const prev = state.fields[event.name] ?? emptyField()
      return {
        ...state,
        fields: {
          ...state.fields,
          [event.name]: {
            ...prev,
            dirty: true,
            clientError: event.clientError,
            serverError: null
          }
        }
      }
    }
    case "Blurred": {
      const prev = state.fields[event.name] ?? emptyField()
      return {
        ...state,
        fields: {
          ...state.fields,
          [event.name]: {
            ...prev,
            touched: true,
            hasShownError:
              prev.hasShownError ||
              event.clientError !== null ||
              prev.serverError !== null,
            clientError: event.clientError
          }
        }
      }
    }
    case "Submitted": {
      const nextFields: Record<string, FieldValidationEntry> = { ...state.fields }
      for (const [name, err] of Object.entries(event.clientErrors)) {
        const prev = nextFields[name] ?? emptyField()
        nextFields[name] = {
          ...prev,
          touched: true,
          hasShownError: prev.hasShownError || err !== null,
          clientError: err
        }
      }
      return {
        ...state,
        submitted: true,
        fields: nextFields
      }
    }
    case "ServerErrorsReceived": {
      const nextFields: Record<string, FieldValidationEntry> = { ...state.fields }
      for (const [name, err] of Object.entries(event.errors)) {
        const prev = nextFields[name] ?? emptyField()
        nextFields[name] = {
          ...prev,
          touched: true,
          hasShownError: prev.hasShownError || err !== null,
          serverError: err
        }
      }
      return {
        ...state,
        submitted: true,
        fields: nextFields
      }
    }
    case "Reset":
      return initialFormValidationState(state.mode)
  }
}

/**
 * Returns the error string to display for `name` according to the active
 * `validationMode`, prioritizing server rejections over client errors.
 */
export const getVisibleFieldError = (
  state: FormValidationState,
  name: string
): string | null => {
  const entry = state.fields[name]
  if (entry === undefined) return null
  if (entry.serverError !== null) return entry.serverError
  if (entry.clientError === null) return null
  if (state.submitted) return entry.clientError
  if (state.mode === "onChange" && entry.dirty) return entry.clientError
  if (state.mode === "onBlur" && entry.hasShownError) return entry.clientError
  return null
}

/**
 * Returns the first invalid field name in `fieldOrder` so `update` can issue
 * `HtmlCommand.focus(fieldRef(name))` immediately after client or async server
 * submission fails (bridging `Effect-TS/ui` `Form`'s documented limit).
 */
export const firstInvalidFieldName = (
  state: FormValidationState,
  fieldOrder: ReadonlyArray<string>
): string | undefined => {
  for (const name of fieldOrder) {
    if (getVisibleFieldError(state, name) !== null) return name
  }
  return undefined
}
