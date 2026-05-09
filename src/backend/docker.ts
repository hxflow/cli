import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { createInterface } from "node:readline"
import Dockerode from "dockerode"
import type { RunSpec, RunEvent, RunResult } from "@hxflow/shared/types"
import type { Backend, RunHandle } from "./types.ts"

function detectSocket(): { socketPath?: string; host?: string; port?: number } {
  if (process.env.DOCKER_HOST) {
    const h = process.env.DOCKER_HOST
    if (h.startsWith("unix://")) return { socketPath: h.slice(7) }
    if (h.startsWith("tcp://")) {
      const u = new URL(h)
      return { host: u.hostname, port: parseInt(u.port || "2375") }
    }
  }
  // Rootless podman socket
  const uid = process.getuid?.() ?? 501
  const podmanSock = `/run/user/${uid}/podman/podman.sock`
  if (existsSync(podmanSock)) return { socketPath: podmanSock }
  // Docker Desktop / standard docker
  const dockerSock = "/var/run/docker.sock"
  if (existsSync(dockerSock)) return { socketPath: dockerSock }
  throw new Error("No container runtime socket found. Set DOCKER_HOST or start docker/podman.")
}

export class DockerBackend implements Backend {
  readonly name = "docker" as const
  private docker: Dockerode

  constructor() {
    this.docker = new Dockerode(detectSocket())
  }

  async start(spec: RunSpec): Promise<RunHandle> {
    mkdirSync(spec.mounts.output, { recursive: true })
    if (!spec.mounts.workspace.startsWith("skip:")) {
      mkdirSync(spec.mounts.workspace, { recursive: true })
    }

    const env: string[] = Object.entries(spec.env).map(([k, v]) => `${k}=${v}`)

    const binds: string[] = [
      `${spec.mounts.output}:/output:rw`,
    ]
    if (!spec.mounts.workspace.startsWith("skip:")) {
      binds.push(`${spec.mounts.workspace}:/workspace:rw`)
    }
    if (spec.auth.mode === "host-pi") {
      binds.push(`${(spec.auth as any).authJsonPath}:/root/.pi/agent/auth.json:rw`)
    }

    const container = await this.docker.createContainer({
      Image: spec.image,
      name: spec.name ? `hx-${spec.runId.slice(-8)}` : undefined,
      Env: env,
      HostConfig: {
        Binds: binds,
        NetworkMode: spec.network,
        Memory: spec.limits.memoryMB ? spec.limits.memoryMB * 1024 * 1024 : undefined,
        NanoCpus: spec.limits.cpus ? Math.round(spec.limits.cpus * 1e9) : undefined,
        PidsLimit: spec.limits.pids,
        AutoRemove: false,
      },
      Labels: { "hx.runId": spec.runId, "hx.managed": "true" },
    })

    await container.start()

    return { runId: spec.runId, backend: "docker", native: container.id }
  }

  async *follow(handle: RunHandle, signal: AbortSignal): AsyncIterable<RunEvent> {
    const id = handle.native as string
    const container = this.docker.getContainer(id)

    // Stream logs
    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      timestamps: false,
    })

    // Demux Docker multiplexed stream
    const logQueue: RunEvent[] = []
    let logDone = false

    ;(async () => {
      for await (const chunk of logStream as AsyncIterable<Buffer>) {
        if (signal.aborted) break
        // Docker log frames: [stream_type(1), 0,0,0(3), size(4), data]
        let offset = 0
        while (offset < chunk.length) {
          if (chunk.length - offset < 8) break
          const streamType = chunk[offset] // 1=stdout, 2=stderr
          const size = chunk.readUInt32BE(offset + 4)
          const data = chunk.slice(offset + 8, offset + 8 + size).toString("utf8")
          offset += 8 + size
          const type = streamType === 2 ? "stderr" : "stdout"
          logQueue.push({ type, ts: new Date().toISOString(), data } as RunEvent)
        }
      }
      logDone = true
    })()

    // Tail trace.jsonl via polling (simple, no fs.watch needed)
    // The trace.jsonl is in the output dir which is bind-mounted
    const traceQueue: RunEvent[] = []
    const runDir = handle.runId ? `${process.env.HOME}/.hx/runs/${handle.runId}` : ""
    const tracePath = `${runDir}/trace.jsonl`
    let traceOffset = 0
    let traceDone = false

    if (runDir) {
      ;(async () => {
        while (!signal.aborted) {
          try {
            if (existsSync(tracePath)) {
              const size = statSync(tracePath).size
              if (size > traceOffset) {
                const buf = Buffer.alloc(size - traceOffset)
                const fd = await Bun.file(tracePath).arrayBuffer()
                const text = Buffer.from(fd).slice(traceOffset, size).toString("utf8")
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
          await new Promise((r) => setTimeout(r, 200))
        }
        traceDone = true
      })()
    }

    // Yield events as they arrive
    while (!signal.aborted) {
      while (logQueue.length > 0) yield logQueue.shift()!
      while (traceQueue.length > 0) yield traceQueue.shift()!

      if (logDone) {
        // Drain remaining trace
        await new Promise((r) => setTimeout(r, 300))
        while (traceQueue.length > 0) yield traceQueue.shift()!
        break
      }
      await new Promise((r) => setTimeout(r, 50))
    }

    traceDone = true

    // Emit result event
    const resultPath = `${runDir}/result.json`
    if (existsSync(resultPath)) {
      try {
        const result = JSON.parse(readFileSync(resultPath, "utf8")) as RunResult
        yield { type: "result", ts: new Date().toISOString(), data: result }
      } catch {}
    }
  }

  async wait(handle: RunHandle): Promise<number> {
    const container = this.docker.getContainer(handle.native as string)
    const { StatusCode } = await container.wait()
    return StatusCode
  }

  async collectArtifacts(_handle: RunHandle, _destDir: string): Promise<void> {
    // Output is already bind-mounted to destDir (runDir), nothing to copy
  }

  async cancel(handle: RunHandle): Promise<void> {
    const container = this.docker.getContainer(handle.native as string)
    await container.stop({ t: 15 })
  }

  async cleanup(handle: RunHandle): Promise<void> {
    try {
      const container = this.docker.getContainer(handle.native as string)
      await container.remove({ force: true })
    } catch {}
  }

  async listActive(): Promise<RunHandle[]> {
    const containers = await this.docker.listContainers({
      filters: JSON.stringify({ label: ["hx.managed=true"] }),
    })
    return containers.map((c) => ({
      runId: c.Labels["hx.runId"] ?? "",
      backend: "docker" as const,
      native: c.Id,
    }))
  }
}
