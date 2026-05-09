import type { RunSpec, RunEvent } from "@hxflow/shared/types"
import type { Backend, RunHandle } from "./types.ts"

export class K8sBackend implements Backend {
  readonly name = "k8s" as const

  async start(_spec: RunSpec): Promise<RunHandle> {
    throw new Error("K8sBackend not implemented yet (Phase 5)")
  }

  async *follow(_handle: RunHandle, _signal: AbortSignal): AsyncIterable<RunEvent> {
    throw new Error("K8sBackend not implemented yet (Phase 5)")
  }

  async wait(_handle: RunHandle): Promise<number> {
    throw new Error("K8sBackend not implemented yet (Phase 5)")
  }

  async collectArtifacts(_handle: RunHandle, _destDir: string): Promise<void> {
    throw new Error("K8sBackend not implemented yet (Phase 5)")
  }

  async cancel(_handle: RunHandle): Promise<void> {
    throw new Error("K8sBackend not implemented yet (Phase 5)")
  }

  async cleanup(_handle: RunHandle): Promise<void> {
    throw new Error("K8sBackend not implemented yet (Phase 5)")
  }

  async listActive(): Promise<RunHandle[]> {
    return []
  }
}
