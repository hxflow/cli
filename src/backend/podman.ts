import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs"
import { spawn } from "node:child_process"
import type { RunSpec, RunEvent, RunResult } from "@hxflow/shared/types"
import type { Backend, RunHandle } from "./types.ts"

function runPodman(args: string[]): string {
  const result = Bun.spawnSync(["podman", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  })
  if (result.exitCode !== 0) {
    const stderr = Buffer.from(result.stderr).toString("utf8").trim()
    throw new Error(stderr || `podman ${args.join(" ")} failed`)
  }
  return Buffer.from(result.stdout).toString("utf8").trim()
}

export class PodmanBackend implements Backend {
  readonly name = "podman" as const

  async start(spec: RunSpec): Promise<RunHandle> {
    mkdirSync(spec.mounts.output, { recursive: true })
    if (!spec.mounts.workspace.startsWith("skip:")) {
      mkdirSync(spec.mounts.workspace, { recursive: true })
    }

    const args = [
      "run",
      "-d",
      "--label", `hx.runId=${spec.runId}`,
      "--label", "hx.managed=true",
      "--network", spec.network,
      "--memory", `${spec.limits.memoryMB ?? 4096}m`,
      "--cpus", String(spec.limits.cpus ?? 2),
      "--pids-limit", String(spec.limits.pids ?? 512),
      "-v", `${spec.mounts.output}:/output:rw`,
    ]

    if (spec.name) args.push("--name", `hx-${spec.runId.slice(-8)}`)
    if (!spec.mounts.workspace.startsWith("skip:")) {
      args.push("-v", `${spec.mounts.workspace}:/workspace:rw`)
    }
    if (spec.auth.mode === "host-pi") {
      args.push("-v", `${(spec.auth as any).authJsonPath}:/root/.pi/agent/auth.json:rw`)
    }
    for (const [key, value] of Object.entries(spec.env)) {
      args.push("-e", `${key}=${value}`)
    }
    args.push(spec.image)

    const id = runPodman(args)
    return { runId: spec.runId, backend: "podman", native: id }
  }

  async *follow(handle: RunHandle, signal: AbortSignal): AsyncIterable<RunEvent> {
    const id = handle.native as string
    const child = spawn("podman", ["logs", "-f", id], { stdio: ["ignore", "pipe", "pipe"] })
    const queue: RunEvent[] = []
    let logsDone = false

    child.stdout.on("data", (chunk) => {
      queue.push({ type: "stdout", ts: new Date().toISOString(), data: chunk.toString("utf8") })
    })
    child.stderr.on("data", (chunk) => {
      queue.push({ type: "stderr", ts: new Date().toISOString(), data: chunk.toString("utf8") })
    })
    child.on("close", () => {
      logsDone = true
    })

    signal.addEventListener("abort", () => {
      child.kill("SIGTERM")
    }, { once: true })

    const traceQueue: RunEvent[] = []
    const runDir = handle.runId ? `${process.env.HOME}/.hx/runs/${handle.runId}` : ""
    const tracePath = `${runDir}/trace.jsonl`
    let traceOffset = 0

    if (runDir) {
      ;(async () => {
        while (!signal.aborted && !logsDone) {
          try {
            if (existsSync(tracePath)) {
              const size = statSync(tracePath).size
              if (size > traceOffset) {
                const text = Buffer.from(await Bun.file(tracePath).arrayBuffer()).slice(traceOffset, size).toString("utf8")
                traceOffset = size
                for (const line of text.split("\n").filter(Boolean)) {
                  try {
                    const entry = JSON.parse(line)
                    traceQueue.push({ type: "trace", ts: entry.ts ?? new Date().toISOString(), data: entry } as RunEvent)
                  } catch {}
                }
              }
            }
          } catch {}
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      })()
    }

    while (!signal.aborted) {
      while (queue.length > 0) yield queue.shift()!
      while (traceQueue.length > 0) yield traceQueue.shift()!
      if (logsDone) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        while (traceQueue.length > 0) yield traceQueue.shift()!
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    const resultPath = `${runDir}/result.json`
    if (existsSync(resultPath)) {
      try {
        const result = JSON.parse(readFileSync(resultPath, "utf8")) as RunResult
        yield { type: "result", ts: new Date().toISOString(), data: result }
      } catch {}
    }
  }

  async wait(handle: RunHandle): Promise<number> {
    const output = runPodman(["wait", handle.native as string])
    return parseInt(output, 10)
  }

  async collectArtifacts(_handle: RunHandle, _destDir: string): Promise<void> {
    // Output is already bind-mounted to destDir (runDir), nothing to copy.
  }

  async cancel(handle: RunHandle): Promise<void> {
    runPodman(["stop", "-t", "15", handle.native as string])
  }

  async cleanup(handle: RunHandle): Promise<void> {
    try {
      runPodman(["rm", "-f", handle.native as string])
    } catch {}
  }

  async listActive(): Promise<RunHandle[]> {
    const output = runPodman(["ps", "--filter", "label=hx.managed=true", "--format", "{{.ID}} {{.Label \"hx.runId\"}}"])
    if (!output) return []
    return output.split("\n").filter(Boolean).map((line) => {
      const [id, runId = ""] = line.trim().split(/\s+/, 2)
      return { runId, backend: "podman" as const, native: id }
    })
  }
}
