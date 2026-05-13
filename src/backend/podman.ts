import { mkdirSync } from "node:fs"
import type { RunSpec, RunEvent } from "@hxflow/shared/types"
import type { Backend, RunHandle } from "./types.ts"
import { tailRun } from "./tail.ts"

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
    if (spec.mounts.authJson) {
      args.push("-v", `${spec.mounts.authJson}:/root/.pi/agent/auth.json:rw`)
    }
    if (spec.mounts.secrets) {
      args.push("-v", `${spec.mounts.secrets}:/run/secrets:ro`)
    }
    for (const [key, value] of Object.entries(spec.env)) {
      args.push("-e", `${key}=${value}`)
    }
    args.push(spec.image)

    const id = runPodman(args)
    return { runId: spec.runId, backend: "podman", native: id }
  }

  async *follow(handle: RunHandle, signal: AbortSignal): AsyncIterable<RunEvent> {
    const runDir = handle.runId ? `${process.env.HOME}/.hx/runs/${handle.runId}` : ""
    if (!runDir) return
    yield* tailRun(runDir, signal)
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
