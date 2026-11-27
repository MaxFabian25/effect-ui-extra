#!/usr/bin/env bun
import { runCli } from "../registry/cli.js"

const res = runCli(process.argv.slice(2), process.cwd())
if (res.stdout.length > 0) process.stdout.write(res.stdout)
if (res.stderr.length > 0) process.stderr.write(res.stderr)
process.exit(res.exitCode)
