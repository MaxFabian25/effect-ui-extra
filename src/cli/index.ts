#!/usr/bin/env bun
import { runCli } from "../registry/cli.js"
import { runMcpServer } from "../registry/mcp.js"

const argv = process.argv.slice(2)
if (argv[0] === "mcp") {
  await runMcpServer()
  process.exit(0)
}

const res = runCli(argv, process.cwd())
if (res.stdout.length > 0) process.stdout.write(res.stdout)
if (res.stderr.length > 0) process.stderr.write(res.stderr)
process.exit(res.exitCode)
