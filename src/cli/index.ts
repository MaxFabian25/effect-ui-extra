#!/usr/bin/env bun
import { runAddAsync, runCli } from "../registry/cli.js"
import { runMcpServer } from "../registry/mcp.js"

const argv = process.argv.slice(2)
if (argv[0] === "mcp") {
  await runMcpServer()
  process.exit(0)
}

if (argv[0] === "add" && argv.slice(1).some((a) => a.startsWith("@"))) {
  const rest = argv.slice(1)
  const overwrite = rest.includes("--overwrite")
  const names = rest.filter((a) => !a.startsWith("--"))
  try {
    const res = await runAddAsync(process.cwd(), names, { overwrite })
    if (res.missing.length > 0) {
      process.stderr.write(`Unknown registry item(s): ${res.missing.join(", ")}\n`)
      process.exit(1)
    }
    process.stdout.write(
      `Added ${res.addedItems.join(", ")} (wrote ${res.writtenFiles.length}, skipped ${res.skippedFiles.length})\n`
    )
    process.exit(0)
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  }
}

const res = runCli(argv, process.cwd())
if (res.stdout.length > 0) process.stdout.write(res.stdout)
if (res.stderr.length > 0) process.stderr.write(res.stderr)
process.exit(res.exitCode)
