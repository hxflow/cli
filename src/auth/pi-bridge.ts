import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

export function authJsonPath(): string {
  return join(homedir(), ".pi", "agent", "auth.json")
}

export function hasAuthJson(): boolean {
  return existsSync(authJsonPath())
}

export function readAuthJson(): unknown {
  if (!hasAuthJson()) return null
  try {
    return JSON.parse(readFileSync(authJsonPath(), "utf8"))
  } catch {
    return null
  }
}

export function detectAuthMode(): "host-pi" | "env-only" {
  if (process.env.CI === "true" || !hasAuthJson()) return "env-only"
  return "host-pi"
}

export function runPiLogin() {
  const result = spawnSync("pi", ["/login"], { stdio: "inherit" })
  if (result.status !== 0) {
    throw new Error("pi login failed")
  }
}

export function authStatus(): { mode: "host-pi" | "env-only"; hasApiKey: boolean; expiresAt?: number } {
  const mode = detectAuthMode()
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY
  if (mode === "host-pi") {
    const auth = readAuthJson() as any
    const expiresAt = auth?.anthropic?.expires
    return { mode, hasApiKey, expiresAt }
  }
  return { mode, hasApiKey }
}
