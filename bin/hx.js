#!/usr/bin/env node

/**
 * hx — Harness Workflow CLI 入口
 *
 * 用法:
 *   hx setup [--dry-run]
 *   hx init [--profile <name>] [--target <dir>]
 *   hx upgrade [--target <dir>] [--dry-run]
 *   hx uninstall [--target <dir>] [--yes] [--dry-run]
 *   hx doc <feature> [--profile <name>]
 *   hx plan <feature> [--profile <name>]
 *   hx ctx [--profile <name>]
 *   hx run <feature> <task-id> [--profile <name>]
 *   hx gate [--profile <name>]
 *   hx review [--profile <name>]
 *   hx fix [--profile <name>]
 *   hx done <task-id>
 *   hx entropy [--profile <name>]
 *   hx mr <feature> [--project <path>] [--target <branch>]
 *   hx check [--profile <name>]
 *   hx version
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(__dirname, '..', 'src', 'scripts')

// ── 子命令映射 ──

const COMMANDS = {
  setup:     'hx-setup.js',
  init:      'hx-init.js',
  upgrade:   'hx-upgrade.js',
  uninstall: 'hx-uninstall.js',
  gate:      'hx-gate.js',
  doc:     'hx-new-doc.js',
  plan:    'hx-new-plan.js',
  run:     'hx-agent-run.js',
  review:  'hx-review-checklist.js',
  fix:     'hx-agent-fix.js',
  done:    'hx-task-done.js',
  entropy: 'hx-entropy-scan.js',
  ctx:     'hx-ctx-check.js',
  check:   'hx-check.js',
  mr:      'hx-mr.js',
}

// ── 帮助信息 ──

function printHelp() {
  console.log(`
  Harness Workflow CLI

  用法: hx <command> [options]

  命令:
    setup     全局安装框架文件到 ~/.hx/ 和 ~/.claude/（首次安装推荐）
    init      初始化项目（创建 docs/、AGENTS.md、.hx/config.json 等）
    upgrade   升级命令文件和 CLAUDE.md 标记块
    uninstall 移除安装痕迹（配置、命令文件、CLAUDE.md 标记块）
    doc       创建需求文档 (Phase 01)
    plan      生成执行计划 (Phase 02)
    ctx       校验上下文完整性 (Phase 03)
    run       按 TASK-ID 执行 (Phase 04)
    gate      运行门控检查 (Phase 04/06)
    review    代码审查 (Phase 05)
    fix       修复 Review 意见 (Phase 05)
    done      标记任务完成
    entropy   熵扫描 (Phase 07)
    mr        创建 Merge Request (Phase 08)
    check     综合检查
    version   显示版本

  全局选项:
    --profile <name>   指定 Profile（backend/frontend/mobile:ios 等）
    --help             显示帮助

  示例:
    hx init --profile backend
    hx doc user-login --profile backend
    hx plan user-login --profile backend
    hx run user-login TASK-BE-01 --profile backend
    hx gate --profile backend
    hx review --profile backend
  `)
}

// ── 版本 ──

function printVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8')
    )
    console.log(`hx v${pkg.version}`)
  } catch {
    console.log('hx v1.0.0')
  }
}

// ── 主流程 ──

const args = process.argv.slice(2)
const command = args[0]

if (!command || command === '--help' || command === '-h') {
  printHelp()
  process.exit(0)
}

if (command === 'version' || command === '--version' || command === '-v') {
  printVersion()
} else if (COMMANDS[command]) {
  const scriptPath = resolve(SCRIPTS_DIR, COMMANDS[command])

  if (!existsSync(scriptPath)) {
    console.error(`  错误: 脚本不存在 — ${COMMANDS[command]}`)
    console.error(`  路径: ${scriptPath}`)
    process.exit(1)
  }

  // 将子命令参数透传给目标脚本
  // 移除第一个参数（子命令名），保留其余参数
  process.argv = [process.argv[0], scriptPath, ...args.slice(1)]

  try {
    await import(scriptPath)
  } catch (err) {
    console.error(`  执行失败: ${err.message}`)
    process.exit(1)
  }
} else {
  console.error(`  未知命令: ${command}`)
  console.error(`  运行 hx --help 查看可用命令`)
  process.exit(1)
}
