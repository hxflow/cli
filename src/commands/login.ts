import { defineCommand } from "citty"
import chalk from "chalk"
import { authStatus, runPiLogin } from "../auth/pi-bridge.ts"
import {
  codexAuthStatus,
  runCodexLogin,
  saveHxCodexConfig,
  readHxProvider,
} from "../auth/codex-bridge.ts"

export default defineCommand({
  meta: { description: "Login to LLM provider (pi or codex)" },
  args: {
    status: { type: "boolean", description: "Show current auth status" },
    provider: {
      type: "string",
      description: "Auth provider: pi (default) | codex",
      default: "",
    },
  },
  run({ args }) {
    const activeProvider = args.provider || readHxProvider() || "pi"

    if (args.status) {
      showStatus(activeProvider as "pi" | "codex")
      return
    }

    if (activeProvider === "codex") {
      loginCodex()
    } else {
      loginPi()
    }
  },
})

function showStatus(provider: "pi" | "codex" | string) {
  const hxProvider = readHxProvider()
  console.log(`active provider: ${chalk.cyan(hxProvider ?? "pi (default)")}`)
  console.log("")

  if (provider === "codex" || provider === "all") {
    const s = codexAuthStatus()
    console.log(chalk.bold("codex (OpenAI):"))
    if (!s.available) {
      console.log(`  status:  ${chalk.dim("not configured (~/.codex/auth.json missing)")}`)
    } else {
      console.log(`  auth mode: ${s.authMode}`)
      console.log(`  source:    ${s.source ?? "unknown"}`)
      if (s.expiresAt) {
        const expired = s.expired
        const label = expired ? chalk.red("EXPIRED") : chalk.green(s.expiresAt.toLocaleString())
        console.log(`  expires:   ${label}`)
      }
    }
    if (provider === "codex") return
    console.log("")
  }

  if (provider === "pi" || provider === "all") {
    const s = authStatus()
    console.log(chalk.bold("pi (Anthropic):"))
    console.log(`  mode:      ${s.mode}`)
    console.log(`  api-key:   ${s.hasApiKey ? chalk.green("set") : chalk.dim("not set")}`)
    if (s.expiresAt) {
      const d = new Date(s.expiresAt)
      const expired = d < new Date()
      console.log(`  expires:   ${expired ? chalk.red("EXPIRED") : chalk.green(d.toLocaleString())}`)
    }
  }
}

function loginCodex() {
  const s = codexAuthStatus()
  if (s.available && !s.expired) {
    console.log(chalk.green("codex is already authenticated."))
    console.log(chalk.dim(`  auth mode: ${s.authMode}, source: ${s.source}`))
    if (s.expiresAt) {
      console.log(chalk.dim(`  expires: ${s.expiresAt.toLocaleString()}`))
    }
    try {
      saveHxCodexConfig()
      console.log(chalk.green("✓ hx will use codex (OpenAI) as the active provider."))
    } catch (err) {
      console.error(chalk.red(String(err)))
      process.exit(1)
    }
    return
  }

  if (s.expired) {
    console.log(chalk.yellow("codex token is expired. Re-authenticating..."))
  } else {
    console.log("Launching codex login flow...")
  }

  try {
    runCodexLogin()
    saveHxCodexConfig()
    console.log(chalk.green("✓ codex login successful. hx will use codex (OpenAI) as the active provider."))
  } catch (err) {
    console.error(chalk.red(String(err)))
    console.log(chalk.dim("Tip: make sure codex CLI is installed (npm i -g @openai/codex)"))
    process.exit(1)
  }
}

function loginPi() {
  console.log("Launching pi login flow...")
  try {
    runPiLogin()
    console.log(chalk.green("✓ pi login successful."))
  } catch (err) {
    console.error(chalk.red(String(err)))
    process.exit(1)
  }
}
