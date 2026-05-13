import type { RunEvent, RunSpec } from "@hxflow/shared/types"
import Dockerode from "dockerode"
import { existsSync, mkdirSync } from "node:fs"
import type { Backend, RunHandle } from "./types.ts"
import { tailRun } from "./tail.ts"

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
    if (spec.mounts.authJson) {
      binds.push(`${spec.mounts.authJson}:/root/.pi/agent/auth.json:rw`)
    }
    if (spec.mounts.secrets) {
      binds.push(`${spec.mounts.secrets}:/run/secrets:ro`)
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
    const runDir = handle.runId ? `${process.env.HOME}/.hx/runs/${handle.runId}` : ""
    if (!runDir) return
    yield* tailRun(runDir, signal)
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
