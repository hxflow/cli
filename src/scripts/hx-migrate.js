#!/usr/bin/env node

import { execFileSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import { parseArgs, readTopLevelYamlScalar } from './lib/config-utils.js'
import { getAgentSkillDir, resolveAgentTargets, SUPPORTED_AGENTS } from './lib/install-utils.js'

const { options } = parseArgs(process.argv.slice(2))
const USER_SETTINGS_FILE = 'settings.yaml'
const __dirname = dirname(fileURLToPath(import.meta.url))
const SETUP_SCRIPT = resolve(__dirname, 'hx-setup.js')

main()

function main() {
  if (options.help) {
    console.log(buildHelpText())
    process.exit(0)
  }

  const dryRun = options['dry-run'] === true
  const userHxDir = options['user-hx-dir']
    ? resolve(options['user-hx-dir'])
    : resolve(homedir(), '.hx')
  const settingsPath = resolve(userHxDir, USER_SETTINGS_FILE)
  const settingsContent = existsSync(settingsPath) ? readFileSync(settingsPath, 'utf8') : ''
  const configuredAgents = readTopLevelYamlScalar(settingsContent, 'agents')
  const { agents, source, deprecatedAgents } = resolveMigrationAgents(configuredAgents)

  printHeader({ agents, source, deprecatedAgents, dryRun, userHxDir })
  runSetup({ agents, dryRun })
}

function resolveMigrationAgents(configuredAgents) {
  if (options.agent) {
    return {
      agents: resolveAgentTargets(options.agent),
      source: 'arguments',
      deprecatedAgents: [],
    }
  }

  const normalized = normalizeLegacyAgents(configuredAgents)
  if (normalized.agents.length > 0) {
    return {
      agents: normalized.agents,
      source: 'settings',
      deprecatedAgents: normalized.deprecatedAgents,
    }
  }

  const inferredAgents = inferInstalledAgents()
  if (inferredAgents.length > 0) {
    return {
      agents: inferredAgents,
      source: 'installed',
      deprecatedAgents: normalized.deprecatedAgents,
    }
  }

  return {
    agents: [...SUPPORTED_AGENTS],
    source: 'default',
    deprecatedAgents: normalized.deprecatedAgents,
  }
}

function normalizeLegacyAgents(rawValue) {
  if (!rawValue) {
    return { agents: [], deprecatedAgents: [] }
  }

  const requested = String(rawValue)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const agents = []
  const deprecatedAgents = []

  for (const agent of requested) {
    if (SUPPORTED_AGENTS.includes(agent)) {
      if (!agents.includes(agent)) agents.push(agent)
    } else {
      deprecatedAgents.push(agent)
    }
  }

  return { agents, deprecatedAgents }
}

function inferInstalledAgents() {
  return SUPPORTED_AGENTS.filter((agent) => {
    const targetDir = resolveAgentDir(agent)
    if (!existsSync(targetDir)) {
      return false
    }

    try {
      return existsSync(resolve(targetDir, 'hx-doc', 'SKILL.md'))
    } catch {
      return false
    }
  })
}

function resolveAgentDir(agent) {
  const overrideKey = `user-${agent}-dir`
  return options[overrideKey]
    ? resolve(options[overrideKey], 'skills')
    : resolve(homedir(), getAgentSkillDir(agent))
}

function runSetup({ agents, dryRun }) {
  const setupArgs = [SETUP_SCRIPT, '--agent', agents.join(',')]

  if (dryRun) {
    setupArgs.push('--dry-run')
  }

  if (options['user-hx-dir']) {
    setupArgs.push('--user-hx-dir', options['user-hx-dir'])
  }

  for (const agent of SUPPORTED_AGENTS) {
    const overrideKey = `user-${agent}-dir`
    if (options[overrideKey]) {
      setupArgs.push(`--${overrideKey}`, options[overrideKey])
    }
  }

  try {
    const output = execFileSync(process.execPath, setupArgs, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: process.env,
    })
    process.stdout.write(output)
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout)
    if (error.stderr) process.stderr.write(error.stderr)
    process.exit(error.status || 1)
  }
}

function printHeader({ agents, source, deprecatedAgents, dryRun, userHxDir }) {
  console.log(`
  Harness Workflow · migrate${dryRun ? ' (dry-run)' : ''}
  source      → ${source}
  agents      → ${agents.join(', ')}
  ~/.hx/      → ${userHxDir}
  `)

  if (deprecatedAgents.length > 0) {
    console.log(`  deprecated  → ${deprecatedAgents.join(', ')}\n`)
  }
}

function buildHelpText() {
  return `
  用法: hx migrate [--dry-run]

  作用:
    将老版本安装产物迁移到当前模型，再重跑 hx setup。

  规则:
    1. 优先使用传入的 --agent
    2. 否则读取 ~/.hx/settings.yaml 中的 agents
    3. 若 settings 中包含已废弃 agent，则自动忽略
    4. 若缺少 settings，则尝试根据现有安装痕迹推断
    5. 仍无法判断时，默认迁移到全部支持的 agents

  选项:
        --dry-run       仅显示迁移计划，不实际写入
        --user-hx-dir   覆盖 ~/.hx 目录（测试用）
        --user-<agent>-dir <dir>
                        覆盖对应 agent 的安装根目录
    -h, --help          显示帮助
  `
}
