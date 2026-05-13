import chalk from "chalk"
import type { TraceEntry } from "@hxflow/shared/types"

interface RendererOptions {
  /** Show LLM thinking_delta in dim text. */
  showThinking?: boolean
}

/**
 * Render a single trace entry to the terminal. Designed to be called per-line as
 * `tailRun()` emits trace events. No state — fits in a callback.
 */
export function renderTraceEntry(entry: TraceEntry, opts: RendererOptions = {}): void {
  const showThinking = opts.showThinking ?? false

  if (entry.kind === "hx") {
    renderHx(entry.hxType, entry.payload)
    return
  }

  // pi events
  switch (entry.piType) {
    case "message_update": {
      const ev = (entry.payload as any)?.assistantMessageEvent
      if (!ev) return
      if (ev.type === "text_delta" && typeof ev.delta === "string") {
        process.stdout.write(ev.delta)
      } else if (ev.type === "thinking_delta" && showThinking && typeof ev.delta === "string") {
        process.stdout.write(chalk.dim(ev.delta))
      }
      return
    }
    case "message_end": {
      // newline after final text; usage will be shown at finalize
      process.stdout.write("\n")
      return
    }
    case "tool_execution_start": {
      const p = entry.payload as any
      const name = p?.toolName ?? "?"
      const argsPreview = previewArgs(p?.args)
      console.log(chalk.cyan(`→ ${name}(${argsPreview})`))
      return
    }
    case "tool_execution_end": {
      const p = entry.payload as any
      const isError = !!p?.isError
      const preview = previewResult(p?.result)
      if (isError) console.log(chalk.red(`← error  ${preview}`))
      else console.log(chalk.gray(`← ok  ${preview}`))
      return
    }
    case "turn_start":
    case "agent_start":
      console.log(chalk.dim("─".repeat(60)))
      return
    case "turn_end":
    case "agent_end":
    case "message_start":
    case "tool_execution_update":
      // intentionally silent
      return
    default:
      // unknown pi event → dim line for forward compat
      console.log(chalk.dim(`[pi:${entry.piType}]`))
      return
  }
}

function renderHx(hxType: string, payload: unknown): void {
  const p = (payload as any) ?? {}
  const msg = p.msg ?? ""
  switch (hxType) {
    case "info":
      console.log(chalk.dim(`[hx] ${msg}`))
      return
    case "warn":
    case "skill_overridden":
      console.log(chalk.yellow(`[hx] ${msg || hxType}`))
      return
    case "error":
      console.log(chalk.red(`[hx error] ${msg || JSON.stringify(p)}`))
      return
    default:
      console.log(chalk.dim(`[hx:${hxType}]`))
  }
}

function previewArgs(args: unknown): string {
  if (!args) return ""
  if (typeof args === "string") return truncate(args, 80)
  try {
    const s = JSON.stringify(args)
    return truncate(s, 80)
  } catch {
    return ""
  }
}

function previewResult(result: unknown): string {
  if (!result) return ""
  const r = result as any
  const first = r?.content?.[0]
  if (first?.type === "text" && typeof first.text === "string") {
    return truncate(first.text.replace(/\s+/g, " "), 100)
  }
  try {
    return truncate(JSON.stringify(result), 100)
  } catch {
    return ""
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1) + "…"
}
