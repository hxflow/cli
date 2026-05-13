import { defineCommand } from "citty"
import { existsSync, readFileSync } from "node:fs"
import chalk from "chalk"
import { readManifest, readResult, outputDir } from "../runs/store.ts"

export default defineCommand({
  meta: { description: "Show details of a run" },
  args: {
    runId: { type: "positional", description: "Run ID" },
    trace: { type: "boolean", description: "Print trace.jsonl events" },
  },
  run({ args }) {
    const runId = args.runId as string
    const manifest = readManifest(runId)
    if (!manifest) {
      console.error(`Run not found: ${runId}`)
      process.exit(1)
    }
    const envelope = readResult(runId)
    const data = envelope?.data as any
    const status = data?.status ?? (envelope?.err === 0 ? "succeeded" : envelope ? "failed" : "running")
    const color = status === "succeeded" ? chalk.green : status === "running" ? chalk.yellow : chalk.red

    console.log(`${color(status)}  ${runId}`)
    console.log(chalk.dim(`  backend: ${manifest.backend}`))
    console.log(chalk.dim(`  image:   ${manifest.spec.image}`))
    console.log(chalk.dim(`  cwd:     ${manifest.invocation.cwd}`))
    console.log(chalk.dim(`  created: ${manifest.createdAt}`))

    if (envelope) {
      if (typeof data?.durationSec === "number") {
        console.log(chalk.dim(`  duration: ${data.durationSec.toFixed(1)}s`))
      }
      if (data?.model) console.log(chalk.dim(`  model:   ${data.model}`))
      if (data?.usage?.totalTokens) {
        console.log(chalk.dim(`  tokens:  ${data.usage.totalTokens} (in:${data.usage.inputTokens} out:${data.usage.outputTokens} cache_r:${data.usage.cacheReadTokens} cache_w:${data.usage.cacheWriteTokens})`))
      }
      if (data?.summary) {
        console.log()
        console.log(data.summary)
      }
      if (Array.isArray(data?.artifacts) && data.artifacts.length > 0) {
        console.log()
        for (const a of data.artifacts) {
          console.log(chalk.blue(`  ${a.type}${a.label ? ` ${a.label}` : ""}: ${a.url}`))
        }
      }
      if (envelope.err !== 0 && envelope.msg) {
        console.log(chalk.red(`  error: ${envelope.msg}`))
      }
    }

    if (args.trace) {
      const tracePath = `${outputDir(runId)}/trace.jsonl`
      if (existsSync(tracePath)) {
        console.log("\n--- trace ---")
        readFileSync(tracePath, "utf8")
          .split("\n")
          .filter(Boolean)
          .forEach((line) => console.log(line))
      }
    }
  },
})
