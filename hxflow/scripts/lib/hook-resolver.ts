import { readRuntimeConfig } from './runtime-config.ts'

export interface HookFile {
  scope: 'project'
  phase: 'pre'
  path: string
}

export interface ResolvedHooks {
  command: string
  preHooks: HookFile[]
  postHooks: HookFile[]
}

function normalizeCommandName(command: string): string {
  const trimmed = command.trim()
  if (!trimmed) {
    throw new Error('命令名不能为空')
  }

  if (trimmed.startsWith('hx-')) return trimmed
  if (trimmed.startsWith('hx ')) return `hx-${trimmed.slice(3).trim()}`
  return `hx-${trimmed}`
}

export function resolveCommandHooks(projectRoot: string, command: string): ResolvedHooks {
  const normalizedCommand = normalizeCommandName(command)
  const runtimeConfig = readRuntimeConfig(projectRoot)
  const commandHooks = runtimeConfig.hooks[normalizedCommand] ?? { pre: [], post: [] }

  const preHooks: HookFile[] = commandHooks.pre.map((path) => ({
    scope: 'project',
    phase: 'pre',
    path,
  }))

  return {
    command: normalizedCommand,
    preHooks,
    postHooks: [],
  }
}
