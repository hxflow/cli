import { DockerBackend } from "./docker.ts"
import { K8sBackend } from "./k8s.ts"
import { PodmanBackend } from "./podman.ts"
import type { Backend } from "./types.ts"

export type { Backend, RunHandle, RunSpec, RunEvent } from "./types.ts"

export function selectBackend(name: "docker" | "podman" | "k8s"): Backend {
  if (name === "k8s") return new K8sBackend()
  if (name === "podman") return new PodmanBackend()
  return new DockerBackend()
}
