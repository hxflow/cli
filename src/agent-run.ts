import { mkdirSync, readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import chalk from "chalk"
import type { RunSpec, RunManifest } from "@hxflow/shared/types"
import { selectBackend } from "./backend/index.ts"
import { loadConfig } from "./config/load.ts"
import { loadProfile } from "./profile/load.ts"
import { newRunId } from "./runs/id.ts"
import { outputDir, workspaceDir, writeManifest, writeHandle } from "./runs/store.ts"
import { authJsonPath, detectAuthMode } from "./auth/pi-bridge.ts"
import { readHxProvider, getCodexCredential, isCodexTokenExpired } from "./auth/codex-bridge.ts"

export interface AgentRunOptions {
  prompt?: string
  file?: string
  cwd?: string
  repo?: string
  name?: string
  profile?: string
  model?: string
  budget?: number
  timeout?: number
  backend?: "docker" | "podman" | "k8s"
  detach?: boolean
  image?: string
}

export async function runAgentRun(opts: AgentRunOptions): Promise<number> {
  const config = loadConfig()
  const backendName = opts.backend ?? config.backend as "docker" | "podman" | "k8s"
  const profileName = opts.profile ?? config.profile
  const profile = loadProfile(profileName)

  // Resolve requirement
  let requirement: string
  if (opts.file) {
    const p = resolve(opts.file)
    if (!existsSync(p)) throw new Error(`Requirement file not found: ${p}`)
    requirement = readFileSync(p, "utf8")
  } else if (opts.prompt) {
    requirement = opts.prompt
  } else {
    throw new Error("Provide --prompt or --file")
  }

  const runId = newRunId()
  const outDir = outputDir(runId)
  mkdirSync(outDir, { recursive: true })

  // Resolve workspace
  let wsDir: string
  if (opts.cwd) {
    wsDir = resolve(opts.cwd)
  } else if (opts.repo) {
    wsDir = workspaceDir(runId, config.workspaceBase)
    mkdirSync(wsDir, { recursive: true })
    console.log(chalk.dim(`Cloning ${opts.repo}...`))
    const r = spawnSync("git", ["clone", opts.repo, wsDir], { stdio: "inherit" })
    if (r.status !== 0) throw new Error(`git clone failed`)
  } else {
    wsDir = resolve(process.cwd())
  }

  // Build RunSpec
  const hxProvider = readHxProvider()
  const authMode = detectAuthMode()
  const env: Record<string, string> = {
    REQUIREMENT: requirement,
    HX_RUN_ID: runId,
    HX_BUDGET_USD: String(opts.budget ?? 5),
    HX_TIMEOUT_SEC: String(opts.timeout ?? profile.limits.timeoutSec),
    HX_OUTPUT_DIR: "/output",
    HX_WORKSPACE_DIR: "/workspace",
    ...(profile.env ?? {}),
  }
  if (opts.model) env.HX_MODEL = opts.model

  if (hxProvider === "codex") {
    // pi auth.json 里已有 openai-codex OAuth 凭证，SDK 会用 openai-codex-responses WebSocket provider
    // 不注入 OPENAI_API_KEY，让 AuthStorage 从挂载的 auth.json 读取
    if (isCodexTokenExpired()) {
      console.log(chalk.yellow("Warning: codex token appears expired. Run `hx login --provider codex` to refresh."))
    }
  } else if (authMode === "env-only" && process.env.ANTHROPIC_API_KEY) {
    env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  }

  const spec: RunSpec = {
    runId,
    image: opts.image ?? config.image,
    env,
    mounts: { workspace: wsDir, output: outDir },
    auth: authMode === "host-pi"
      ? { mode: "host-pi", authJsonPath: authJsonPath() }
      : { mode: "env-only" },
    limits: {
      ...profile.limits,
      timeoutSec: (opts.timeout ?? profile.limits.timeoutSec) + 30, // 30s buffer
    },
    network: profile.network,
    name: opts.name,
    detach: opts.detach ?? false,
  }

  const manifest: RunManifest = {
    runId,
    invocation: {
      command: process.argv,
      cwd: process.cwd(),
      user: process.env.USER ?? "unknown",
      hostname: (await import("node:os")).hostname(),
    },
    spec: { ...spec, env: Object.fromEntries(Object.keys(spec.env).map((k) => [k, k.includes("KEY") || k.includes("TOKEN") ? "<redacted>" : spec.env[k]])) },
    profile: { name: profileName, source: "file" },
    backend: backendName,
    nativeHandle: null,
    createdAt: new Date().toISOString(),
  }
  writeManifest(manifest)

  const backend = selectBackend(backendName)

  console.log(chalk.green(`▶ run ${runId}`))
  console.log(chalk.dim(`  image: ${spec.image}`))
  console.log(chalk.dim(`  workspace: ${wsDir}`))

  const handle = await backend.start(spec)
  writeHandle(runId, { ...handle, containerId: handle.native })
  manifest.nativeHandle = handle.native
  writeManifest({ ...manifest, nativeHandle: handle.native })

  if (opts.detach) {
    console.log(chalk.yellow(`Container started (detached). Track with: hx run get ${runId}`))
    return 0
  }

  // Follow logs + events
  const ac = new AbortController()
  process.once("SIGINT", () => {
    console.log(chalk.yellow("\nCancelling..."))
    backend.cancel(handle).catch(() => {})
    ac.abort()
  })

  for await (const event of backend.follow(handle, ac.signal)) {
    if (event.type === "stdout") process.stdout.write(event.data)
    else if (event.type === "stderr") process.stderr.write(chalk.dim(event.data))
    else if (event.type === "result") {
      const r = event.data as any
      const ok = r.status === "succeeded"
      console.log(ok ? chalk.green(`\n✓ ${r.status}`) : chalk.red(`\n✗ ${r.status}`))
      console.log(chalk.dim(`  cost: $${r.usage?.costUsd?.toFixed(4) ?? "?"}`))
      console.log(chalk.dim(`  duration: ${r.durationSec?.toFixed(1)}s`))
      if (r.mrUrl) console.log(chalk.blue(`  MR: ${r.mrUrl}`))
    }
  }

  await backend.cleanup(handle)

  // 优先从 result.json 读退出码（比 container.wait 更可靠，podman 兼容）
  const { readResult } = await import("./runs/store.ts")
  const result = readResult(runId)
  return result?.exitCode ?? 0
}
