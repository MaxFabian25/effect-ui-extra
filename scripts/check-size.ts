import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const BUDGET_PATH = resolve(ROOT, "size-budget.json")

interface SizeTarget {
  readonly key: string
  readonly entry: string
  readonly kind: "ts" | "css"
}

const TARGETS: ReadonlyArray<SizeTarget> = [
  { key: "effect-ui-extra/a11y", entry: "src/a11y/index.ts", kind: "ts" },
  { key: "effect-ui-extra/page", entry: "src/page/index.ts", kind: "ts" },
  { key: "effect-ui-extra/widgets", entry: "src/widgets/index.ts", kind: "ts" },
  { key: "effect-ui-extra/direct", entry: "src/direct/index.ts", kind: "ts" },
  { key: "effect-ui-extra/theme", entry: "src/theme/index.ts", kind: "ts" },
  { key: "effect-ui-extra/theme/effect-ui.css", entry: "styles/effect-ui.css", kind: "css" },
  { key: "effect-ui-extra/motion", entry: "src/motion/index.ts", kind: "ts" },
  { key: "effect-ui-extra/registry", entry: "src/registry/index.ts", kind: "ts" }
]

const measureTarget = async (target: SizeTarget): Promise<{ readonly raw: number; readonly gzip: number }> => {
  const abs = resolve(ROOT, target.entry)
  if (target.kind === "css") {
    const bytes = readFileSync(abs)
    return { raw: bytes.byteLength, gzip: Bun.gzipSync(bytes).byteLength }
  }
  const built = await Bun.build({
    entrypoints: [abs],
    target: "browser",
    format: "esm",
    minify: true,
    external: ["effect", "effect/*", "@effect/ui", "@effect/ui/*", "@effect/ui-kit", "@effect/ui-kit/*", "node:fs", "node:path"]
  })
  if (!built.success) {
    throw new Error(`Bundle failed for ${target.key}: ${built.logs.map((l) => l.message).join("\n")}`)
  }
  const output = built.outputs[0]
  if (output === undefined) throw new Error(`No output for ${target.key}`)
  const bytes = new Uint8Array(await output.arrayBuffer())
  return { raw: bytes.byteLength, gzip: Bun.gzipSync(bytes).byteLength }
}

const writeBudget = process.argv.includes("--write")
const measured: Record<string, { readonly raw: number; readonly gzip: number }> = {}
for (const t of TARGETS) {
  measured[t.key] = await measureTarget(t)
}

if (writeBudget) {
  const budget: Record<string, number> = {}
  for (const t of TARGETS) {
    const gz = measured[t.key]!.gzip
    // Round up to nearest 256 bytes with ~20% headroom so minor fixes do not flake while real bloat trips CI
    budget[t.key] = Math.ceil((gz * 1.2) / 256) * 256
  }
  writeFileSync(BUDGET_PATH, `${JSON.stringify(budget, null, 2)}\n`, "utf8")
  console.log("Wrote size-budget.json:")
  for (const t of TARGETS) {
    const m = measured[t.key]!
    console.log(`  ${t.key.padEnd(38)} raw=${String(m.raw).padStart(6)}B  gzip=${String(m.gzip).padStart(5)}B  budget=${budget[t.key]}B`)
  }
  process.exit(0)
}

const budget = JSON.parse(readFileSync(BUDGET_PATH, "utf8")) as Readonly<Record<string, number>>
let failed = false

for (const t of TARGETS) {
  const m = measured[t.key]!
  const limit = budget[t.key]
  if (limit === undefined) {
    console.error(`MISSING BUDGET for ${t.key}`)
    failed = true
    continue
  }
  const status = m.gzip <= limit ? "OK  " : "OVER"
  console.log(`  [${status}] ${t.key.padEnd(38)} raw=${String(m.raw).padStart(6)}B  gzip=${String(m.gzip).padStart(5)}B / ${limit}B`)
  if (m.gzip > limit) failed = true
}

if (failed) {
  process.exit(1)
}
