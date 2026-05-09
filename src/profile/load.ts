import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "yaml"
import { hxDir } from "../config/load.ts"
import type { RunSpec } from "@hxflow/shared/types"

export interface Profile {
  name: string
  limits: RunSpec["limits"]
  network: RunSpec["network"]
  tools?: string[]
  env?: Record<string, string>
}

const BUILTIN: Record<string, Profile> = {
  default: {
    name: "default",
    limits: { timeoutSec: 1800, memoryMB: 4096, cpus: 2, pids: 512 },
    network: "bridge",
  },
  readonly: {
    name: "readonly",
    limits: { timeoutSec: 900, memoryMB: 2048, cpus: 1, pids: 256 },
    network: "none",
    tools: ["read", "grep", "find", "ls"],
  },
  "ci-strict": {
    name: "ci-strict",
    limits: { timeoutSec: 1200, memoryMB: 4096, cpus: 2, pids: 512, budgetUsd: 2 } as any,
    network: "none",
  },
}

export function profilesDir(): string {
  return join(hxDir(), "profiles")
}

function ensureBuiltins() {
  const dir = profilesDir()
  mkdirSync(dir, { recursive: true })
  for (const [name, profile] of Object.entries(BUILTIN)) {
    const path = join(dir, `${name}.yaml`)
    if (!existsSync(path)) {
      writeFileSync(path, `# hx built-in profile: ${name}\n` + JSON.stringify(profile, null, 2))
    }
  }
}

export function loadProfile(name: string): Profile {
  ensureBuiltins()
  const path = join(profilesDir(), `${name}.yaml`)
  if (existsSync(path)) {
    return parse(readFileSync(path, "utf8")) as Profile
  }
  if (BUILTIN[name]) return BUILTIN[name]
  throw new Error(`Profile "${name}" not found in ${profilesDir()}`)
}
