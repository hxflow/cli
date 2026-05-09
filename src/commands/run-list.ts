import { defineCommand } from "citty"
import chalk from "chalk"
import { listRuns, readResult } from "../runs/store.ts"

export default defineCommand({
  meta: { description: "List recent runs" },
  args: {
    limit: { type: "string", description: "Max runs to show (default: 20)" },
  },
  run({ args }) {
    const runs = listRuns(args.limit ? parseInt(args.limit) : 20)
    if (runs.length === 0) {
      console.log("No runs found.")
      return
    }
    for (const m of runs) {
      const result = readResult(m.runId)
      const status = result?.status ?? "running"
      const cost = result?.usage?.costUsd != null ? `$${result.usage.costUsd.toFixed(4)}` : "—"
      const dur = result?.durationSec != null ? `${result.durationSec.toFixed(0)}s` : "—"
      const color = status === "succeeded" ? chalk.green : status === "running" ? chalk.yellow : chalk.red
      console.log(`${color(status.padEnd(16))} ${m.runId}  ${cost.padStart(9)}  ${dur.padStart(6)}  ${m.invocation.cwd}`)
    }
  },
})
