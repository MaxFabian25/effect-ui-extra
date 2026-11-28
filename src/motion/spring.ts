export interface SpringConfig {
  /** Spring stiffness (tension). Defaults to `300`. */
  readonly stiffness?: number | undefined
  /**
   * Spring damping (friction). Defaults to critical damping
   * (`2 * Math.sqrt(stiffness * mass)`, zero overshoot). Pass a smaller value
   * to opt into underdamped bounce.
   */
  readonly damping?: number | undefined
  /** Mass attached to the spring. Defaults to `1`. */
  readonly mass?: number | undefined
  /** Initial velocity in units per second (`from -> to` normalized space when used with easing). Defaults to `0`. */
  readonly velocity?: number | undefined
  /** Position displacement threshold below which the spring is considered settled. Defaults to `0.001`. */
  readonly restDisplacement?: number | undefined
  /** Velocity threshold below which the spring is considered settled. Defaults to `0.001`. */
  readonly restVelocity?: number | undefined
}

export interface SpringSample {
  readonly position: number
  readonly velocity: number
  readonly done: boolean
}

const resolveConfig = (config: SpringConfig = {}) => {
  const stiffness = Math.max(1e-4, config.stiffness ?? 300)
  const mass = Math.max(1e-4, config.mass ?? 1)
  return {
    stiffness,
    damping: Math.max(0, config.damping ?? 2 * Math.sqrt(stiffness * mass)),
    mass,
    velocity: config.velocity ?? 0,
    restDisplacement: Math.max(1e-6, config.restDisplacement ?? 0.001),
    restVelocity: Math.max(1e-6, config.restVelocity ?? 0.001)
  }
}

/**
 * Closed-form analytical spring evaluator moving from `from` to `to` at time
 * `tSeconds >= 0`, covering underdamped, critically damped, and overdamped
 * regimes accurately without numerical integration drift.
 */
export const solveSpring = (
  tSeconds: number,
  from: number,
  to: number,
  config: SpringConfig = {}
): SpringSample => {
  const { damping, mass, restDisplacement, restVelocity, stiffness, velocity } =
    resolveConfig(config)
  const t = Math.max(0, tSeconds)
  const x0 = from - to
  const v0 = velocity

  if (Math.abs(x0) <= restDisplacement && Math.abs(v0) <= restVelocity) {
    return { position: to, velocity: 0, done: true }
  }

  const w0 = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))

  let disp: number
  let vel: number

  if (zeta < 1 - 1e-6) {
    // Underdamped
    const wd = w0 * Math.sqrt(1 - zeta * zeta)
    const env = Math.exp(-zeta * w0 * t)
    const A = x0
    const B = (v0 + zeta * w0 * x0) / wd
    const cos = Math.cos(wd * t)
    const sin = Math.sin(wd * t)
    disp = env * (A * cos + B * sin)
    vel =
      env *
      ((-zeta * w0 * A + wd * B) * cos + (-zeta * w0 * B - wd * A) * sin)
  } else if (Math.abs(zeta - 1) <= 1e-6) {
    // Critically damped
    const env = Math.exp(-w0 * t)
    const A = x0
    const B = v0 + w0 * x0
    disp = env * (A + B * t)
    vel = env * (B - w0 * (A + B * t))
  } else {
    // Overdamped
    const root = w0 * Math.sqrt(zeta * zeta - 1)
    const r1 = -w0 * zeta + root
    const r2 = -w0 * zeta - root
    const c1 = (v0 - r2 * x0) / (r1 - r2)
    const c2 = x0 - c1
    const e1 = Math.exp(r1 * t)
    const e2 = Math.exp(r2 * t)
    disp = c1 * e1 + c2 * e2
    vel = c1 * r1 * e1 + c2 * r2 * e2
  }

  const done =
    Math.abs(disp) <= restDisplacement && Math.abs(vel) <= restVelocity
  return {
    position: done ? to : to + disp,
    velocity: done ? 0 : vel,
    done
  }
}

/**
 * Estimates the settle duration in milliseconds where a unit (`0 -> 1`) spring
 * remains continuously within rest thresholds.
 */
export const settleTime = (
  config: SpringConfig = {},
  maxMs = 5000
): number => {
  const stepMs = 4
  const holdSteps = 5
  let consecutiveDone = 0
  for (let ms = stepMs; ms <= maxMs; ms += stepMs) {
    const sample = solveSpring(ms / 1000, 0, 1, config)
    if (sample.done) {
      consecutiveDone += 1
      if (consecutiveDone >= holdSteps) {
        return ms - (holdSteps - 1) * stepMs
      }
    } else {
      consecutiveDone = 0
    }
  }
  return maxMs
}

export interface SpringCssEasing {
  readonly durationMs: number
  readonly easing: string
}

/**
 * Generates a pure CSS `linear(...)` timing function + duration so spring
 * physics run on the browser compositor with zero per-frame JavaScript.
 */
export const springLinearEasing = (
  config: SpringConfig = {},
  samples?: number
): SpringCssEasing => {
  const durationMs = settleTime(config)
  const resolved =
    samples ?? Math.min(120, Math.max(32, Math.ceil(durationMs / 16)))
  const count = Math.max(4, Math.floor(resolved))
  const points: Array<string> = []
  for (let i = 0; i <= count; i++) {
    const tSec = ((i / count) * durationMs) / 1000
    const val = i === 0 ? 0 : i === count ? 1 : solveSpring(tSec, 0, 1, config).position
    points.push(String(Math.round(val * 10000) / 10000))
  }
  return {
    durationMs,
    easing: `linear(${points.join(", ")})`
  }
}
