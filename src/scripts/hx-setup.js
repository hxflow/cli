#!/usr/bin/env node

/** hx setup 只负责创建 ~/.hx 目录骨架、写 ~/.hx/settings.yaml，并生成 Claude/Codex 适配层。 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'

import { FRAMEWORK_ROOT, PACKAGE_ROOT } from './lib/resolve-context.js'
import {
  parseArgs,
  readTopLevelYamlScalar,
  upsertTopLevelYamlScalar,
} from './lib/config-utils.js'
import {
  generateCodexSkillFiles,
  generateForwarderFiles,
  loadCommandSpecs,
  mergeCommandSpecs,
  resolveAgentTargets,
} from './lib/install-utils.js'

const USER_LAYER_DIRS = ['commands', 'hooks', 'pipelines']
const USER_SETTINGS_FILE = 'settings.yaml'
const USER_SETTINGS_CONTENT = `# Harness Workflow 用户级配置\nframeworkRoot: ${PACKAGE_ROOT}\n`

const { options } = parseArgs(process.argv.slice(2))

if (options.help) {
  console.log(buildHelpText())
  process.exit(0)
}

const dryRun = options['dry-run'] === true
const agents = resolveAgentTargets(options.agent)
const userHxDir = options['user-hx-dir']
  ? resolve(options['user-hx-dir'])
  : resolve(homedir(), '.hx')
const userClaudeDir = options['user-claude-dir']
  ? resolve(options['user-claude-dir'])
  : resolve(homedir(), '.claude')
const userCodexDir = options['user-codex-dir']
  ? resolve(options['user-codex-dir'])
  : resolve(homedir(), '.codex')

const summary = { created: [], updated: [], removed: [], skipped: [], warnings: [] }

printSetupHeader({ agents, dryRun, userHxDir, userClaudeDir, userCodexDir })

ensureUserLayerDirectories(userHxDir, summary, dryRun)
ensureUserSettingsFile(userHxDir, summary, dryRun)

const frameworkCommandDir = resolve(FRAMEWORK_ROOT, 'commands')
const userCommandDir = resolve(userHxDir, 'commands')
const commandSpecs = mergeCommandSpecs(
  loadCommandSpecs(frameworkCommandDir),
  loadCommandSpecs(userCommandDir)
)

if (agents.includes('claude')) {
  generateForwarderFiles(
    commandSpecs,
    resolve(userClaudeDir, 'commands'),
    FRAMEWORK_ROOT,
    userHxDir,
    summary,
    { createDir: true, dryRun }
  )
}

if (agents.includes('codex')) {
  generateCodexSkillFiles(
    commandSpecs,
    resolve(userCodexDir, 'skills'),
    FRAMEWORK_ROOT,
    userHxDir,
    summary,
    { createDir: true, dryRun }
  )
}

printSummary(summary, dryRun)

function ensureUserLayerDirectories(userHxDir, summary, dryRun) {
  for (const sub of ['', ...USER_LAYER_DIRS]) {
    const dir = sub ? resolve(userHxDir, sub) : userHxDir
    if (!existsSync(dir)) {
      if (!dryRun) mkdirSync(dir, { recursive: true })
      summary.created.push(`~/.hx/${sub || ''}`.replace(/\/$/, '') + '/')
    }
  }
}

function ensureUserSettingsFile(userHxDir, summary, dryRun) {
  const userSettingsPath = resolve(userHxDir, USER_SETTINGS_FILE)

  if (!existsSync(userSettingsPath)) {
    if (!dryRun) writeFileSync(userSettingsPath, USER_SETTINGS_CONTENT, 'utf8')
    summary.created.push('~/.hx/settings.yaml')
    return
  }

  const previousContent = readFileSync(userSettingsPath, 'utf8')
  const existingFrameworkRoot = readTopLevelYamlScalar(previousContent, 'frameworkRoot')

  if (existingFrameworkRoot === PACKAGE_ROOT) {
    summary.skipped.push('~/.hx/settings.yaml (已存在)')
    return
  }

  const nextContent = upsertTopLevelYamlScalar(previousContent, 'frameworkRoot', PACKAGE_ROOT)
  if (!dryRun) writeFileSync(userSettingsPath, nextContent, 'utf8')
  summary.updated.push('~/.hx/settings.yaml (frameworkRoot)')
}

function printSetupHeader({ agents, dryRun, userHxDir, userClaudeDir, userCodexDir }) {
  const lines = [
    `\n  Harness Workflow · setup${dryRun ? ' (dry-run)' : ''}`,
    `  agents      → ${agents.join(', ')}`,
    `  ~/.hx/      → ${userHxDir}`,
  ]

  if (agents.includes('claude')) lines.push(`  ~/.claude/  → ${userClaudeDir}`)
  if (agents.includes('codex')) lines.push(`  ~/.codex/   → ${userCodexDir}`)

  for (const line of lines) console.log(line)
  console.log('')
}

function printSummary(summary, dryRun) {
  console.log('  ── 安装报告 ──\n')
  for (const [title, items, marker] of [
    ['创建', summary.created, '+'],
    ['更新', summary.updated, '~'],
    ['删除', summary.removed, 'x'],
    ['跳过', summary.skipped, '-'],
    ['警告', summary.warnings, '!'],
  ]) {
    if (items.length === 0) continue
    console.log(`  ${title}:`)
    for (const item of items) console.log(`    ${marker} ${item}`)
  }
  console.log(`\n  ${dryRun ? '[dry-run] 未实际写入。' : '完成。后续请在 Agent 会话中运行 hx-init。'}\n`)
}

function buildHelpText() {
  return `
  用法: hx setup [--agent <claude|codex|all>] [--dry-run]

  选项:
        --agent <name>  安装目标 agent，支持 claude、codex、all（默认 all）
        --dry-run       仅显示将要安装的内容，不实际写入
    -h, --help          显示帮助

  将框架文件安装到用户全局目录：
    ~/.hx/              用户层目录骨架（commands/、hooks/、pipelines/）
    ~/.hx/settings.yaml 用户级配置（记录 frameworkRoot）
    ~/.claude/commands/ Claude 转发器文件（按三层优先级路由到实体命令）
    ~/.codex/skills/    Codex skill 目录（每个命令一个子目录，内含 SKILL.md）

  npm 安装包时会自动执行一次 setup。
  hx setup 用于手动修复、补装或重跑安装逻辑。

  注意：不会把框架内置命令、Hook、Pipeline 复制到 ~/.hx/ 下。
  hx setup 会安装 Claude 转发器和 Codex skill bundle。
  业务侧自定义 skill 仍由用户自行管理。

  安装后，在 Agent 会话中运行 hx-init 初始化项目。
  `
}
