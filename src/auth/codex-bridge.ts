import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

export interface CodexAuth {
  auth_mode: "chatgpt" | "api_key"
  OPENAI_API_KEY: string | null
  tokens?: {
    id_token: string
    access_token: string
    refresh_token: string
    account_id: string
  }
  last_refresh?: string
}

export interface CodexCredential {
  apiKey: string
  source: "access_token" | "api_key"
  expiresAt?: number
}

export function codexAuthPath(): string {
  return join(homedir(), ".codex", "auth.json")
}

export function hasCodexAuth(): boolean {
  return existsSync(codexAuthPath())
}

export function readCodexAuth(): CodexAuth | null {
  if (!hasCodexAuth()) return null
  try {
    return JSON.parse(readFileSync(codexAuthPath(), "utf8")) as CodexAuth
  } catch {
    return null
  }
}

function decodeJwtExp(token: string): number | undefined {
  try {
    const payload = token.split(".")[1]
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString())
    return decoded.exp
  } catch {
    return undefined
  }
}

export function getCodexCredential(): CodexCredential | null {
  const auth = readCodexAuth()
  if (!auth) return null

  if (auth.auth_mode === "api_key" && auth.OPENAI_API_KEY) {
    return { apiKey: auth.OPENAI_API_KEY, source: "api_key" }
  }

  if (auth.auth_mode === "chatgpt" && auth.tokens?.access_token) {
    const token = auth.tokens.access_token
    const expiresAt = decodeJwtExp(token)
    return { apiKey: token, source: "access_token", expiresAt }
  }

  return null
}

export function isCodexTokenExpired(): boolean {
  const cred = getCodexCredential()
  if (!cred || !cred.expiresAt) return false
  return Date.now() / 1000 > cred.expiresAt
}

export function runCodexLogin(): void {
  const result = spawnSync("codex", ["login", "--device-auth"], { stdio: "inherit" })
  if (result.status !== 0) throw new Error("codex login failed")
}

export function codexAuthStatus(): {
  available: boolean
  authMode?: string
  source?: string
  expiresAt?: Date
  expired?: boolean
} {
  const auth = readCodexAuth()
  if (!auth) return { available: false }

  const cred = getCodexCredential()
  if (!cred) return { available: true, authMode: auth.auth_mode }

  const expiresAt = cred.expiresAt ? new Date(cred.expiresAt * 1000) : undefined
  const expired = expiresAt ? expiresAt < new Date() : false

  return {
    available: true,
    authMode: auth.auth_mode,
    source: cred.source,
    expiresAt,
    expired,
  }
}

// Write a local hx copy so agent-run can detect codex as the active provider
export function saveHxCodexConfig(): void {
  const dir = join(homedir(), ".hx", "auth")
  mkdirSync(dir, { recursive: true })
  const cred = getCodexCredential()
  if (!cred) throw new Error("No valid codex credential found")
  const meta = { provider: "codex", source: cred.source, savedAt: new Date().toISOString() }
  writeFileSync(join(dir, "provider.json"), JSON.stringify(meta, null, 2))
}

export function readHxProvider(): string | null {
  const path = join(homedir(), ".hx", "auth", "provider.json")
  if (!existsSync(path)) return null
  try {
    const data = JSON.parse(readFileSync(path, "utf8"))
    return data.provider ?? null
  } catch {
    return null
  }
}
