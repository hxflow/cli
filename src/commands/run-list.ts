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
      const envelope = readResult(m.runId)
      const data = envelope?.data as any
      const status = data?.status ?? (envelope?.err === 0 ? "succeeded" : envelope ? "failed" : "running")
      const dur = typeof data?.durationSec === "number" ? `${data.durationSec.toFixed(0)}s` : "—"
      const color = status === "succeeded" ? chalk.green : status === "running" ? chalk.yellow : chalk.red
      console.log(`${color(status.padEnd(16))} ${m.runId}  ${dur.padStart(6)}  ${m.invocation.cwd}`)
    }
  },
})
