import { existsSync, readFileSync, statSync } from "node:fs"
import type { AgentResponse, RunEvent, TraceEntry } from "@hxflow/shared/types"

const POLL_MS = 200
const QUIET_MS = 500

/**
 * Single-source backend follow: tail trace.jsonl, yield `{type:"trace"}` events;
 * once `pi.agent_end` is seen (or result.json appears and trace is quiet), yield
 * `{type:"result"}` once and stop.
 *
 * Both podman and docker backends use this — there's no separate stdout/stderr
 * channel anymore; agent writes everything to trace.jsonl.
 */
export async function* tailRun(
  runDir: string,
  signal: AbortSignal,
): AsyncIterable<RunEvent> {
  const tracePath = `${runDir}/trace.jsonl`
  const resultPath = `${runDir}/result.json`
  let offset = 0
  let agentEnded = false
  let lastNewAt = Date.now()

  while (!signal.aborted) {
    let yieldedThisRound = 0
    if (existsSync(tracePath)) {
      try {
        const size = statSync(tracePath).size
        if (size > offset) {
          const buf = readFileSync(tracePath)
          const chunk = buf.slice(offset, size).toString("utf8")
          offset = size
          for (const line of chunk.split("\n")) {
            if (!line) continue
            let entry: TraceEntry | null = null
            try {
              entry = JSON.parse(line) as TraceEntry
            } catch {
              continue
            }
            const ts = entry.ts ?? new Date().toISOString()
            yield { type: "trace", ts, data: entry }
            yieldedThisRound++
            if (entry.kind === "pi" && entry.piType === "agent_end") {
              agentEnded = true
            }
          }
          if (yieldedThisRound > 0) lastNewAt = Date.now()
        }
      } catch {
        // ignore transient read failure
      }
    }

    // Stop conditions:
    //   ① agent_end already observed AND result.json on disk
    //   ② result.json on disk AND no new trace for QUIET_MS (container died unexpectedly)
    if (agentEnded && existsSync(resultPath)) break
    if (existsSync(resultPath) && Date.now() - lastNewAt > QUIET_MS) break

    await new Promise((r) => setTimeout(r, POLL_MS))
  }

  if (existsSync(resultPath)) {
    try {
      const result = JSON.parse(readFileSync(resultPath, "utf8")) as AgentResponse
      yield { type: "result", ts: new Date().toISOString(), data: result }
    } catch {
      // unparsable — caller can fall back to exit code
    }
  }
}
