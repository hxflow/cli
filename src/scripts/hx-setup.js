#!/usr/bin/env node

/**
 * hx setup — 全局安装框架文件到用户目录
 *
 * 安装内容：
 *   1. profiles/ → ~/.hx/profiles/（内置 profiles，供所有项目共享）
 *   2. agents/commands/hx-*.md → ~/.claude/commands/（全局 Claude 命令）
 *   3. agents/skills/ → ~/.claude/skills/（全局 Claude skills）
 *   4. 创建 ~/.hx/config.json（如不存在，写入空配置）
 *
 * 幂等设计：重复运行安全。
 *
 * 测试隔离参数（非正式公开）：
 *   --user-hx-dir <dir>      覆盖 ~/.hx/ 路径
 *   --user-claude-dir <dir>  覆盖 ~/.claude/ 路径
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'

import { FRAMEWORK_ROOT } from './lib/resolve-context.js'
import { parseArgs } from './lib/profile-utils.js'
import {
  syncCommandFiles,
  syncSkillDirs,
  syncProfilesToUserDir
} from './lib/install-utils.js'

// ── CLI 参数 ──

const { options } = parseArgs(process.argv.slice(2))

if (options.help) {
  console.log(`
  用法: hx setup [--dry-run]

  选项:
        --dry-run       仅显示将要安装的内容，不实际写入
    -h, --help          显示帮助

  将框架文件安装到用户全局目录：
    ~/.hx/profiles/       内置 profiles（所有项目共享）
    ~/.claude/commands/   hx-*.md 命令文件（Claude Code 全局命令）
    ~/.claude/skills/     hx skill 文件（Claude Code 全局 skills）
    ~/.hx/config.json     用户全局配置（如不存在则创建空配置）

  安装后，在任意项目中运行 hx init 即可使用框架，无需再拷贝 profiles。
  `)
  process.exit(0)
}

const dryRun = options['dry-run'] === true
const userHxDir = options['user-hx-dir']
  ? resolve(options['user-hx-dir'])
  : resolve(homedir(), '.hx')
const userClaudeDir = options['user-claude-dir']
  ? resolve(options['user-claude-dir'])
  : resolve(homedir(), '.claude')

const summary = { created: [], updated: [], skipped: [], warnings: [] }

console.log(`\n  Harness Workflow · setup${dryRun ? ' (dry-run)' : ''}`)
console.log(`  ~/.hx/      → ${userHxDir}`)
console.log(`  ~/.claude/  → ${userClaudeDir}\n`)

// ── Step 1: 确保 ~/.hx/ 目录存在 ──

if (!existsSync(userHxDir)) {
  if (!dryRun) mkdirSync(userHxDir, { recursive: true })
  summary.created.push('~/.hx/')
}

// ── Step 2: 创建 ~/.hx/config.json（如不存在）──

const userConfigPath = resolve(userHxDir, 'config.json')
if (!existsSync(userConfigPath)) {
  if (!dryRun) writeFileSync(userConfigPath, '{}\n', 'utf8')
  summary.created.push('~/.hx/config.json')
} else {
  summary.skipped.push('~/.hx/config.json (已存在)')
}

// ── Step 3: 同步 profiles → ~/.hx/profiles/ ──

syncProfilesToUserDir(
  resolve(FRAMEWORK_ROOT, 'profiles'),
  resolve(userHxDir, 'profiles'),
  summary,
  { dryRun }
)

// ── Step 4: 同步命令文件 → ~/.claude/commands/ ──

syncCommandFiles(
  resolve(FRAMEWORK_ROOT, 'agents', 'commands'),
  resolve(userClaudeDir, 'commands'),
  summary,
  { createDir: true, dryRun }
)

// ── Step 5: 同步 skills → ~/.claude/skills/ ──

syncSkillDirs(
  resolve(FRAMEWORK_ROOT, 'agents', 'skills'),
  resolve(userClaudeDir, 'skills'),
  summary,
  { createDir: true, dryRun }
)

// ── 输出报告 ──

console.log('  ── 安装报告 ──\n')

if (summary.created.length > 0) {
  console.log('  创建:')
  for (const item of summary.created) console.log(`    + ${item}`)
}

if (summary.updated.length > 0) {
  console.log('  更新:')
  for (const item of summary.updated) console.log(`    ~ ${item}`)
}

if (summary.skipped.length > 0) {
  console.log('  跳过:')
  for (const item of summary.skipped) console.log(`    - ${item}`)
}

if (summary.warnings.length > 0) {
  console.log('  警告:')
  for (const item of summary.warnings) console.log(`    ! ${item}`)
}

console.log(`\n  ${dryRun ? '[dry-run] 未实际写入。' : '完成。运行 hx init 初始化项目。'}\n`)
