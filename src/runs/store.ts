import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { AgentResponse, RunManifest } from "@hxflow/shared/types"
import { hxDir } from "../config/load.ts"

export function runsDir(): string {
  return join(hxDir(), "runs")
}

export function runDir(runId: string): string {
  return join(runsDir(), runId)
}

export function outputDir(runId: string): string {
  return runDir(runId)
}

export function workspaceDir(runId: string, workspaceBase?: string): string {
  const base = workspaceBase ?? runsDir()
  return join(base, runId, "workspace")
}

export function writeManifest(manifest: RunManifest) {
  const dir = runDir(manifest.runId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2))
}

export function readManifest(runId: string): RunManifest | null {
  const path = join(runDir(runId), "manifest.json")
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, "utf8")) as RunManifest
}

export function readResult(runId: string): AgentResponse | null {
  const path = join(outputDir(runId), "result.json")
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, "utf8")) as AgentResponse
}

const RUN_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function listRuns(limit = 20): RunManifest[] {
  const dir = runsDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => RUN_ID_RE.test(name) || name.startsWith("r-")) // accept legacy + uuid
    .sort()
    .reverse()
    .slice(0, limit)
    .map((name) => readManifest(name))
    .filter((m): m is RunManifest => m !== null)
}

export function writeHandle(runId: string, handle: unknown) {
  writeFileSync(join(runDir(runId), "handle.json"), JSON.stringify(handle, null, 2))
}

export function readHandle(runId: string): unknown {
  const path = join(runDir(runId), "handle.json")
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, "utf8"))
}
