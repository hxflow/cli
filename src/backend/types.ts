import type { RunSpec, RunEvent } from "@hxflow/shared/types"

export type { RunSpec, RunEvent }

export interface RunHandle {
  runId: string
  backend: "docker" | "podman" | "k8s"
  /** Backend-native handle (container id etc). Callers don't inspect this. */
  native: unknown
}

export interface Backend {
  readonly name: "docker" | "podman" | "k8s"
  start(spec: RunSpec): Promise<RunHandle>
  follow(handle: RunHandle, signal: AbortSignal): AsyncIterable<RunEvent>
  wait(handle: RunHandle): Promise<number>
  collectArtifacts(handle: RunHandle, destDir: string): Promise<void>
  cancel(handle: RunHandle): Promise<void>
  cleanup(handle: RunHandle): Promise<void>
  listActive(): Promise<RunHandle[]>
}
