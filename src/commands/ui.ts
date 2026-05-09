import { defineCommand } from "citty"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import chalk from "chalk"

function uiDir() { return join(homedir(), ".hx", "ui") }
function pidFile() { return join(uiDir(), "server.pid") }
function portFile() { return join(uiDir(), "server.port") }
function tokenFile() { return join(uiDir(), "token") }

function readToken() {
  const p = tokenFile()
  return existsSync(p) ? readFileSync(p, "utf8").trim() : null
}

function serverUrl() {
  const port = existsSync(portFile()) ? readFileSync(portFile(), "utf8").trim() : "7878"
  const token = readToken()
  return `http://localhost:${port}/${token ? `?token=${token}` : ""}`
}

function isAlive(pid: number) {
  try { process.kill(pid, 0); return true } catch { return false }
}

export default defineCommand({
  meta: { description: "hxflow web UI server" },
  args: {
    port: { type: "string", description: "Port (default: 7878)" },
    host: { type: "string", description: "Host (default: 0.0.0.0)" },
    "no-open": { type: "boolean", description: "Don't open browser" },
    stop: { type: "boolean", description: "Stop the UI server" },
    status: { type: "boolean", description: "Show server status" },
  },
  async run({ args }) {
    if (args.stop) {
      const pidPath = pidFile()
      if (!existsSync(pidPath)) { console.log("UI server not running."); return }
      const pid = parseInt(readFileSync(pidPath, "utf8"))
      try { process.kill(pid, "SIGTERM"); console.log(chalk.yellow(`Stopped pid ${pid}`)) }
      catch { console.log("Process already stopped.") }
      return
    }

    if (args.status) {
      const pidPath = pidFile()
      if (!existsSync(pidPath)) { console.log("UI server not running."); return }
      const pid = parseInt(readFileSync(pidPath, "utf8"))
      if (isAlive(pid)) {
        console.log(`running  pid=${pid}  ${serverUrl()}`)
      } else {
        console.log("UI server not running (stale pid file).")
      }
      return
    }

    // Start server
    const pidPath = pidFile()
    if (existsSync(pidPath)) {
      const pid = parseInt(readFileSync(pidPath, "utf8"))
      if (isAlive(pid)) {
        const url = serverUrl()
        console.log(chalk.dim(`UI already running at ${url}`))
        if (!args["no-open"]) Bun.spawn(["open", url], { stdio: ["ignore", "ignore", "ignore"] })
        return
      }
    }

    const port = args.port ?? "7878"
    const host = args.host ?? "0.0.0.0"

    // Find hx-console binary or fallback to workspace path
    const uiServerPath = join(import.meta.dir, "../../../ui/server/index.ts")

    mkdirSync(uiDir(), { recursive: true })
    const proc = Bun.spawn(
      ["bun", uiServerPath],
      {
        stdio: ["ignore", "ignore", "ignore"],
        detached: true,
        env: { ...process.env, HX_UI_PORT: port, HX_UI_HOST: host },
      }
    )

    writeFileSync(pidFile(), String(proc.pid))
    writeFileSync(portFile(), port)
    proc.unref()

    // Give server a moment to write token
    await new Promise((r) => setTimeout(r, 800))

    const url = serverUrl()
    console.log(chalk.green(`hx-console started`) + chalk.dim(`  pid=${proc.pid}`))
    console.log(url)
    if (!args["no-open"]) Bun.spawn(["open", url], { stdio: ["ignore", "ignore", "ignore"] })
  },
})
