import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { parse, type Tags } from "yaml"
import { hxDir } from "../config/load.ts"
import type { RunSpec } from "@hxflow/shared/types"

export type AuthProvider = "anthropic" | "openai" | "openai-codex"

export interface EnvironmentAuth {
  provider: AuthProvider
  /**
   * 对于 anthropic / openai：从宿主此 env var 取 API key 注入容器。
   */
  apiKeyEnv?: string
  /**
   * 宿主上 pi 格式 auth.json 的路径（OAuth 凭证），CLI 把它 bind-mount 到容器
   * `/root/.pi/agent/auth.json:rw`。pi SDK 内置 AuthStorage 会自动读取并按需刷新。
   *
   * 用法：环境配置里写 `authJsonPath: ~/.pi/agent/auth.json`（codex / anthropic OAuth 都走此通道）。
   */
  authJsonPath?: string
}

export interface Environment {
  name: string
  image?: string
  model?: string
  auth: EnvironmentAuth
  limits: RunSpec["limits"]
  network: RunSpec["network"]
  tools?: string[]
  /** Resolved env entries to inject into the container. */
  env?: Record<string, string>
}

const BUILTIN: Record<string, Environment> = {
  default: {
    name: "default",
    auth: { provider: "anthropic", apiKeyEnv: "ANTHROPIC_API_KEY" },
    limits: { timeoutSec: 1800, memoryMB: 4096, cpus: 2, pids: 512 },
    network: "bridge",
  },
  codex: {
    name: "codex",
    auth: { provider: "openai-codex", authJsonPath: "~/.pi/agent/auth.json" },
    limits: { timeoutSec: 1800, memoryMB: 4096, cpus: 2, pids: 512 },
    network: "bridge",
  },
  readonly: {
    name: "readonly",
    auth: { provider: "anthropic", apiKeyEnv: "ANTHROPIC_API_KEY" },
    limits: { timeoutSec: 900, memoryMB: 2048, cpus: 1, pids: 256 },
    network: "none",
    tools: ["read", "grep", "find", "ls"],
  },
  "ci-strict": {
    name: "ci-strict",
    auth: { provider: "anthropic", apiKeyEnv: "ANTHROPIC_API_KEY" },
    limits: { timeoutSec: 1200, memoryMB: 4096, cpus: 2, pids: 512 },
    network: "none",
  },
}

export function environmentsDir(): string {
  return join(hxDir(), "environments")
}

function ensureBuiltins() {
  const dir = environmentsDir()
  mkdirSync(dir, { recursive: true })
  for (const [name, env] of Object.entries(BUILTIN)) {
    const path = join(dir, `${name}.yaml`)
    if (!existsSync(path)) {
      writeFileSync(path, `# hx built-in environment: ${name}\n` + JSON.stringify(env, null, 2))
    }
  }
}

const FILE_TAG_PREFIX = "__hxfile__:"

/**
 * Custom yaml tag `!file <path>` → marker string `__hxfile__:<path>` for the
 * resolver pass to expand later.
 */
const customTags: Tags = [
  {
    tag: "!file",
    resolve: (value: string) => `${FILE_TAG_PREFIX}${value.trim()}`,
  },
]

export function loadEnvironment(name: string): Environment {
  ensureBuiltins()
  const path = join(environmentsDir(), `${name}.yaml`)
  let raw: Environment
  if (existsSync(path)) {
    raw = parse(readFileSync(path, "utf8"), { customTags }) as Environment
  } else if (BUILTIN[name]) {
    raw = BUILTIN[name]
  } else {
    throw new Error(`Environment "${name}" not found in ${environmentsDir()}`)
  }

  if (raw.env) {
    raw.env = resolveEnv(raw.env, name)
  }
  return raw
}

/**
 * Resolve env values: interpolate `${VAR}` / `${VAR:?msg}` from host env, and
 * expand `!file <path>` markers by reading the host file (trim trailing newline).
 * Throws on unresolved required vars or missing files.
 */
export function resolveEnv(env: Record<string, string>, envName = ""): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(env)) {
    const v = String(raw)
    if (v.startsWith(FILE_TAG_PREFIX)) {
      const filePath = expandHome(v.slice(FILE_TAG_PREFIX.length))
      if (!existsSync(filePath)) {
        throw new Error(`environment "${envName}" env.${key}: file not found: ${filePath}`)
      }
      out[key] = readFileSync(filePath, "utf8").replace(/\n+$/, "")
    } else {
      out[key] = interpolate(v, key, envName)
    }
  }
  return out
}

function interpolate(input: string, key: string, envName: string): string {
  return input.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::\?([^}]*))?\}/g, (_, name, required) => {
    const v = process.env[name]
    if (v === undefined || v === "") {
      if (required !== undefined) {
        const msg = required.trim() || `${name} is required`
        throw new Error(`environment "${envName}" env.${key}: ${msg}`)
      }
      return ""
    }
    return v
  })
}

function expandHome(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2))
  if (p === "~") return homedir()
  return p
}
