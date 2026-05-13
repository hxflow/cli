import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { parse } from "yaml"

export interface HxConfig {
  backend: "docker" | "podman" | "k8s"
  image: string
  environment: string
  workspaceBase?: string
}

const DEFAULTS: HxConfig = {
  backend: "podman",
  image: "localhost/hxflow-agent:dev",
  environment: "default",
}

export function hxDir(): string {
  return join(homedir(), ".hx")
}

export function loadConfig(): HxConfig {
  const configPath = join(hxDir(), "config.yaml")
  mkdirSync(hxDir(), { recursive: true })
  if (!existsSync(configPath)) return { ...DEFAULTS }
  try {
    const raw = parse(readFileSync(configPath, "utf8")) as Partial<HxConfig>
    return { ...DEFAULTS, ...raw }
  } catch {
    return { ...DEFAULTS }
  }
}
