#!/usr/bin/env node

/**
 * hx upgrade — 升级已安装的 Harness Workflow
 *
 * 行为：
 *   1. 用框架最新版本覆盖 agent 命令文件
 *   2. 更新 CLAUDE.md 中的 harness 标记块
 *   3. 保留项目文档与源码，不覆盖业务文件
 *
 * 幂等设计：重复运行安全。
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

import { FRAMEWORK_ROOT, findProjectRoot } from './lib/resolve-context.js'
import { parseArgs, readJsonFile } from './lib/profile-utils.js'
import {
  HARNESS_MARKER_START,
  HARNESS_MARKER_END,
  buildHarnessBlock,
  escapeRegExp,
  syncCommandFiles,
  syncSkillDirs
} from './lib/install-utils.js'

// ── CLI 参数 ──

const { options } = parseArgs(process.argv.slice(2))

if (options.help) {
  console.log(`
  用法: hx upgrade [-t <dir>] [--dry-run]

  选项:
    -t, --target <dir>  目标项目目录（默认当前目录）
        --dry-run       仅显示将要更新的内容，不实际写入
    -h, --help          显示帮助

  自定义命令:
    在 .hx/config.json 中添加 "pinnedCommands" 可阻止指定命令被升级覆盖：
      { "pinnedCommands": ["hx-run", "hx-review"] }

    在 .claude/commands/ 中新增的 hx-*.md 文件（非框架内置）不受升级影响。
  `)
  process.exit(0)
}

const targetDir = options.target ? resolve(options.target) : process.cwd()
const dryRun = options['dry-run'] === true

const projectRoot = findProjectRoot(targetDir)
const summary = { updated: [], skipped: [], warnings: [] }

// 读取用户固定的命令列表（仅 .hx/config.json）
const newConfigPath = resolve(projectRoot, '.hx', 'config.json')
const config = existsSync(newConfigPath) ? (readJsonFile(newConfigPath) ?? {}) : {}
const pinnedCommands = new Set(Array.isArray(config.pinnedCommands) ? config.pinnedCommands : [])

console.log(`\n  Harness Workflow · upgrade${dryRun ? ' (dry-run)' : ''}`)
console.log(`  目标: ${projectRoot}\n`)

// ── Step 1: 升级命令文件 ──

syncCommandFiles(
  resolve(FRAMEWORK_ROOT, 'agents', 'commands'),
  resolve(projectRoot, '.claude', 'commands'),
  summary,
  { overwrite: true, dryRun, pinnedCommands }
)

// ── Step 1b: 升级 skills ──

syncSkillDirs(
  resolve(FRAMEWORK_ROOT, 'agents', 'skills'),
  resolve(projectRoot, '.claude', 'skills'),
  summary,
  { overwrite: true, dryRun }
)

// ── Step 2: 更新 CLAUDE.md 标记块 ──

upgradeCLAUDEmd(projectRoot, summary)

// ── 输出报告 ──

console.log('  ── 升级报告 ──\n')

if (summary.updated.length) {
  console.log('  更新:')
  for (const item of summary.updated) console.log(`    ~ ${item}`)
}

if (summary.skipped.length) {
  console.log('  跳过:')
  for (const item of summary.skipped) console.log(`    - ${item}`)
}

if (summary.warnings.length) {
  console.log('  警告:')
  for (const item of summary.warnings) console.log(`    ! ${item}`)
}

console.log(`\n  ${dryRun ? '[dry-run] 未实际写入。' : '完成。'}\n`)

// ── 函数 ──

function upgradeCLAUDEmd(projectRoot, summary) {
  const claudePath = resolve(projectRoot, 'CLAUDE.md')

  if (!existsSync(claudePath)) {
    summary.warnings.push('CLAUDE.md 不存在，跳过标记块更新')
    return
  }

  const content = readFileSync(claudePath, 'utf8')

  if (!content.includes(HARNESS_MARKER_START)) {
    summary.warnings.push('CLAUDE.md 中未找到 harness 标记块，跳过（可运行 hx init 重新安装）')
    return
  }

  // 读取当前 profile 从标记块中提取
  const profileMatch = content.match(/Profile: `([^`]+)`/)
  const profile = profileMatch?.[1] || 'backend'

  const newBlock = buildHarnessBlock(profile)
  const currentBlock = content.match(
    new RegExp(`${escapeRegExp(HARNESS_MARKER_START)}[\\s\\S]*?${escapeRegExp(HARNESS_MARKER_END)}`)
  )?.[0]

  if (currentBlock === newBlock) {
    summary.skipped.push('CLAUDE.md (标记块无变化)')
    return
  }

  if (!dryRun) {
    const updated = content.replace(
      new RegExp(`${escapeRegExp(HARNESS_MARKER_START)}[\\s\\S]*?${escapeRegExp(HARNESS_MARKER_END)}`),
      newBlock
    )
    writeFileSync(claudePath, updated)
  }

  summary.updated.push('CLAUDE.md (harness 标记块)')
}
