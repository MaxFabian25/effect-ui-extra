import * as Effect from "effect/Effect"
import type { Scope } from "effect/Scope"
import { auditPattern } from "./checkPattern.js"
import { PatternViolationError } from './types.js';
import type { A11yTarget, ApgPattern, CheckPatternOptions, Direction, PatternViolation } from './types.js';

export type DirectionAuditResult = {
  readonly ltr: ReadonlyArray<PatternViolation>
  readonly rtl: ReadonlyArray<PatternViolation>
}

/**
 * Mounts a widget in both `"ltr"` and `"rtl"` directions and audits the WAI-ARIA
 * APG pattern in each, returning all collected violations grouped by direction.
 */
export const auditDirection = <E, R>(
  mount: (direction: Direction) => Effect.Effect<A11yTarget, E, R>,
  pattern: ApgPattern,
  options?: Omit<CheckPatternOptions, "direction">
): Effect.Effect<DirectionAuditResult, E, Exclude<R, Scope>> =>
  Effect.gen(function*() {
    const ltr = yield* Effect.scoped(
      Effect.gen(function*() {
        const target = yield* mount("ltr")
        return yield* auditPattern(target, pattern, { ...options, direction: "ltr" })
      })
    )
    const rtl = yield* Effect.scoped(
      Effect.gen(function*() {
        const target = yield* mount("rtl")
        return yield* auditPattern(target, pattern, { ...options, direction: "rtl" })
      })
    )
    return { ltr, rtl }
  })

/**
 * Verifies a widget against a WAI-ARIA APG pattern in both `"ltr"` and `"rtl"`.
 * Fails with `PatternViolationError` listing every violation found in either
 * direction, prefixed with `[ltr]` or `[rtl]`.
 */
export const checkDirection = <E, R>(
  mount: (direction: Direction) => Effect.Effect<A11yTarget, E, R>,
  pattern: ApgPattern,
  options?: Omit<CheckPatternOptions, "direction">
): Effect.Effect<void, E | PatternViolationError, Exclude<R, Scope>> =>
  Effect.gen(function*() {
    const { ltr, rtl } = yield* auditDirection(mount, pattern, options)
    const tagged: Array<PatternViolation> = [
      ...ltr.map((v) => ({ ...v, rule: `ltr:${v.rule}` })),
      ...rtl.map((v) => ({ ...v, rule: `rtl:${v.rule}` }))
    ]
    if (tagged.length > 0) {
      return yield* new PatternViolationError({ pattern, violations: tagged })
    }
  })
