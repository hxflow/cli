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
    const result = readResult(runId)
    const status = result?.status ?? "running"
    const color = status === "succeeded" ? chalk.green : status === "running" ? chalk.yellow : chalk.red

    console.log(`${color(status)}  ${runId}`)
    console.log(chalk.dim(`  backend: ${manifest.backend}`))
    console.log(chalk.dim(`  image:   ${manifest.spec.image}`))
    console.log(chalk.dim(`  cwd:     ${manifest.invocation.cwd}`))
    console.log(chalk.dim(`  created: ${manifest.createdAt}`))

    if (result) {
      console.log(chalk.dim(`  cost:    $${result.usage.costUsd.toFixed(4)}`))
      console.log(chalk.dim(`  tokens:  ${result.usage.totalTokens}`))
      console.log(chalk.dim(`  duration: ${result.durationSec.toFixed(1)}s`))
      if (result.mrUrl) console.log(chalk.blue(`  MR: ${result.mrUrl}`))
      if (result.errorSummary) console.log(chalk.red(`  error: ${result.errorSummary}`))
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
