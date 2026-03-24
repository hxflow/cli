#!/usr/bin/env node

/**
 * hx upgrade — 升级已安装的 Harness Workflow
 *
 * 行为：
 *   1. 用框架最新版本覆盖 .claude/commands/hx-*.md
 *   2. 更新 CLAUDE.md 中的 harness 标记块
 *   3. 保留用户自定义内容（.harness/ 目录不改动）
 *
 * 幂等设计：重复运行安全。
 */

import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

import { FRAMEWORK_ROOT } from './lib/resolve-context.js'
import { findProjectRoot } from './lib/resolve-context.js'

const HARNESS_MARKER_START = '<!-- harness-workflow:start -->'
const HARNESS_MARKER_END = '<!-- harness-workflow:end -->'

// ── CLI 参数 ──

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  用法: hx upgrade [--target <dir>] [--dry-run]

  选项:
    --target <dir>   目标项目目录（默认当前目录）
    --dry-run        仅显示将要更新的内容，不实际写入
    --help           显示帮助
  `)
  process.exit(0)
}

let targetDir = process.cwd()
let dryRun = false

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--target' || args[i] === '-t') && args[i + 1]) {
    targetDir = resolve(args[++i])
  } else if (args[i] === '--dry-run') {
    dryRun = true
  } else if (args[i] === 'upgrade') {
    // 跳过子命令本身
  }
}

const projectRoot = findProjectRoot(targetDir)
const summary = { updated: [], skipped: [], warnings: [] }

console.log(`\n  Harness Workflow · upgrade${dryRun ? ' (dry-run)' : ''}`)
console.log(`  目标: ${projectRoot}\n`)

// ── Step 1: 升级命令文件 ──

upgradeCommands(projectRoot, summary)

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

function upgradeCommands(projectRoot, summary) {
  const sourceDir = resolve(FRAMEWORK_ROOT, '.claude', 'commands')
  const targetCmdsDir = resolve(projectRoot, '.claude', 'commands')

  if (!existsSync(sourceDir)) {
    summary.warnings.push('框架命令目录不存在，跳过命令升级')
    return
  }

  if (!existsSync(targetCmdsDir)) {
    summary.warnings.push('.claude/commands/ 目录不存在，请先运行 hx init')
    return
  }

  const files = readdirSync(sourceDir).filter(f => f.startsWith('hx-') && f.endsWith('.md'))

  for (const file of files) {
    const srcPath = resolve(sourceDir, file)
    const dstPath = resolve(targetCmdsDir, file)

    if (!existsSync(dstPath)) {
      // 新增的命令文件
      if (!dryRun) cpSync(srcPath, dstPath)
      summary.updated.push(`.claude/commands/${file} (新增)`)
      continue
    }

    const srcContent = readFileSync(srcPath, 'utf8')
    const dstContent = readFileSync(dstPath, 'utf8')

    if (srcContent === dstContent) {
      summary.skipped.push(`.claude/commands/${file} (无变化)`)
    } else {
      if (!dryRun) cpSync(srcPath, dstPath)
      summary.updated.push(`.claude/commands/${file}`)
    }
  }
}

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

function buildHarnessBlock(profile) {
  return `${HARNESS_MARKER_START}
## Harness Workflow

本项目已启用 Harness Workflow Framework。

- 配置: \`.harness/config.yaml\`
- Profile: \`${profile}\`
- 需求文档: \`.harness/requirement/\`
- 执行计划: \`.harness/plans/\`
- Agent 索引: \`.harness/AGENTS.md\`

可用命令: \`/hx-go\` \`/hx-doc\` \`/hx-plan\` \`/hx-run\` \`/hx-review\` \`/hx-gate\` \`/hx-entropy\` \`/hx-mr\`

执行规则和上下文详见 \`.harness/AGENTS.md\`
${HARNESS_MARKER_END}`
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
