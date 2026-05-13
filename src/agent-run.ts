import { mkdirSync, readFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import chalk from "chalk"
import type { RunSpec, RunManifest, Artifact } from "@hxflow/shared/types"
import { selectBackend } from "./backend/index.ts"
import { loadConfig } from "./config/load.ts"
import { loadEnvironment } from "./environment/load.ts"
import { newRunId } from "./runs/id.ts"
import { outputDir, workspaceDir, writeManifest, writeHandle } from "./runs/store.ts"
import { renderTraceEntry } from "./render/trace.ts"

export interface AgentRunOptions {
  prompt?: string
  file?: string
  cwd?: string
  repo?: string
  name?: string
  environment?: string
  model?: string
  timeout?: number
  backend?: "docker" | "podman" | "k8s"
  detach?: boolean
  image?: string
  showThinking?: boolean
}

export async function runAgentRun(opts: AgentRunOptions): Promise<number> {
  const config = loadConfig()
  const backendName = opts.backend ?? config.backend as "docker" | "podman" | "k8s"
  const environmentName = opts.environment ?? config.environment
  const environment = loadEnvironment(environmentName)

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

  // Build container env: environment.env (already resolved) + a few CLI-derived fields.
  const image = opts.image ?? environment.image ?? config.image
  const env: Record<string, string> = {
    REQUIREMENT: requirement,
    HX_RUN_ID: runId,
    HX_TIMEOUT_SEC: String(opts.timeout ?? environment.limits.timeoutSec),
    HX_OUTPUT_DIR: "/output",
    HX_WORKSPACE_DIR: "/workspace",
    HX_ENVIRONMENT_NAME: environmentName,
    HX_IMAGE: image,
    HX_SOURCE: env_source(),
    HX_EXECUTION_LOCATION: backendName === "k8s" ? "remote" : "local",
    ...(environment.env ?? {}),
  }
  if (opts.model ?? environment.model) env.HX_MODEL = (opts.model ?? environment.model)!
  if (environment.auth?.provider) env.HX_PROVIDER = environment.auth.provider

  // LLM auth: three paths, all forwarded to pi which picks env > auth.json in its priority order.
  //   A) environment.auth.apiKeyEnv → forward host env var of that name into container (convenience)
  //   B) environment.env entries (explicit) — already merged above via `...environment.env`
  //   C) environment.auth.authJsonPath → bind-mount host pi auth.json into container at
  //      /root/.pi/agent/auth.json:rw. pi's AuthStorage reads OAuth credentials and refreshes natively.
  if (environment.auth?.apiKeyEnv) {
    const name = environment.auth.apiKeyEnv
    const value = process.env[name]
    if (value) {
      env[name] = value
    } else if (!environment.auth.authJsonPath) {
      console.log(chalk.yellow(`Warning: host ${name} is unset and no authJsonPath fallback declared.`))
    }
  }
  let authJsonMount: string | undefined
  if (environment.auth?.authJsonPath) {
    const expanded = expandHome(environment.auth.authJsonPath)
    if (!existsSync(expanded)) {
      console.log(chalk.yellow(
        `Warning: authJsonPath "${environment.auth.authJsonPath}" does not exist (resolved: ${expanded}). ` +
        `Run \`pi login\` to create it, or rely on env-based credentials instead.`,
      ))
    } else {
      authJsonMount = expanded
    }
  }

  const spec: RunSpec = {
    runId,
    image,
    env,
    mounts: { workspace: wsDir, output: outDir, ...(authJsonMount ? { authJson: authJsonMount } : {}) },
    auth: { mode: "env-only" },
    limits: {
      ...environment.limits,
      timeoutSec: (opts.timeout ?? environment.limits.timeoutSec) + 30,
    },
    network: environment.network,
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
    environment: { name: environmentName, source: "file" },
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

  // Follow trace stream + final result envelope
  const ac = new AbortController()
  process.once("SIGINT", () => {
    console.log(chalk.yellow("\nCancelling..."))
    backend.cancel(handle).catch(() => {})
    ac.abort()
  })

  for await (const event of backend.follow(handle, ac.signal)) {
    if (event.type === "trace") {
      renderTraceEntry(event.data, { showThinking: opts.showThinking })
    } else if (event.type === "result") {
      const r = event.data
      const status = r.data?.status ?? (r.err === 0 ? "succeeded" : "failed")
      const color = r.err === 0 ? chalk.green : chalk.red
      console.log(color(`\n${r.err === 0 ? "✓" : "✗"} ${status}  (err=${r.err}, msg=${r.msg ?? ""})`))
      if (typeof r.data?.durationSec === "number") {
        console.log(chalk.dim(`  duration: ${r.data.durationSec.toFixed(1)}s`))
      }
      const mr = pickPrimaryArtifact(r.data?.artifacts)
      if (mr) console.log(chalk.blue(`  ${mr.type.toUpperCase()}: ${mr.url}`))
    }
  }

  await backend.cleanup(handle)

  // Map envelope.err → process exit code (preserves agent's failure mode).
  const { readResult } = await import("./runs/store.ts")
  const result = readResult(runId)
  return result?.err ?? 0
}

function pickPrimaryArtifact(artifacts: Artifact[] | undefined): Artifact | undefined {
  if (!artifacts || artifacts.length === 0) return undefined
  return artifacts.find((a) => a.type === "pr" || a.type === "mr") ?? artifacts[0]
}

function env_source(): string {
  if (process.env.HX_SOURCE) return process.env.HX_SOURCE
  return "hxflow-cli"
}

function expandHome(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2))
  if (p === "~") return homedir()
  return p
}
