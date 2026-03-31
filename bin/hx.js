#!/usr/bin/env node

/**
 * hx — Harness Workflow CLI 入口
 *
 * 内置命令:
 *   hx setup [--dry-run]
 *   hx migrate [--dry-run]
 *   hx version
 *
 * 其他 hx-* 能力通过 agent 命令 contract 提供，不是本地 Node 子命令。
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync } from 'fs'
import {
  BUILTIN_CLI_COMMANDS,
  loadCommandSpecs,
  mergeCommandSpecs,
} from '../src/scripts/lib/install-utils.js'
import { USER_HX_DIR, findProjectRoot } from '../src/scripts/lib/resolve-context.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(__dirname, '..', 'src', 'scripts')
const FRAMEWORK_COMMAND_DIR = resolve(__dirname, '..', 'src', 'commands')
const PACKAGE_JSON_PATH = resolve(__dirname, '..', 'package.json')
const BUILTIN_SCRIPTS = {
  setup: 'hx-setup.js',
  migrate: 'hx-migrate.js',
}
const projectRoot = findProjectRoot(process.cwd())
const installedCommandSpecs = mergeCommandSpecs(
  loadCommandSpecs(FRAMEWORK_COMMAND_DIR),
  loadCommandSpecs(resolve(USER_HX_DIR, 'commands')),
  loadCommandSpecs(resolve(projectRoot, '.hx', 'commands'))
)
const installedCommandNames = new Set(installedCommandSpecs.map((spec) => spec.name))

function printHelp() {
  const contractList = formatCommandList(installedCommandSpecs.map((spec) => spec.name))

  console.log(`
  Harness Workflow CLI

  用法: hx <command> [options]

  内置命令:
    setup     手动重跑全局安装/修复 ~/.hx 与各 agent skill 入口
    migrate   执行老版本安装产物迁移并重跑 setup
    version   输出当前 CLI 版本

  自定义工作流:
    共享命令放在 ~/.hx/commands/hx-*.md，执行 hx setup 后生成适配层
    项目级 .hx/commands/hx-*.md 只负责覆盖同名 contract
    Claude 使用 /hx-*；Codex 使用 hx-*；除 setup / migrate / version 外，其余 hx-* 都不是本地 Node 子命令

  当前可见命令 contract:
${contractList}

  全局选项:
    --help    显示帮助

  示例:
    npm install -g @hxflow/cli
    hx setup                     # 首次安装或手动修复安装产物
    hx migrate                   # 从老版本安装产物迁移到当前模型
    hx version                   # 查看版本
  `)
}

function printVersion() {
  try {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'))
    console.log(`hx v${pkg.version}`)
  } catch {
    console.log('hx v1.0.0')
  }
}

const args = process.argv.slice(2)
const command = args[0]

if (!command || command === '--help' || command === '-h') {
  printHelp()
  process.exit(0)
}

if (command === 'version' || command === '--version' || command === '-v') {
  printVersion()
  process.exit(0)
}

const script = BUILTIN_SCRIPTS[command]

if (!script) {
  if (installedCommandNames.has(command)) {
    console.error(`  "${command}" 是 agent 命令 contract。Claude 使用 "/${command}"，Codex 使用 "${command}"。`)
  } else {
    printUnknownCommand(command)
  }
  process.exit(1)
}

function formatCommandList(commands) {
  if (commands.length === 0) {
    return '    (未发现命令 contract)'
  }

  const lines = []

  for (let index = 0; index < commands.length; index += 4) {
    lines.push(`    ${commands.slice(index, index + 4).join('  ')}`)
  }

  return lines.join('\n')
}

function printUnknownCommand(commandName) {
  console.error(`  未知命令: ${commandName}`)
  console.error('  新增共享命令：在 ~/.hx/commands/hx-*.md 中编写 contract 后运行 hx setup 安装适配层')
  console.error(`  项目级覆写：在 ${projectRoot}/.hx/commands/ 中放同名 hx-*.md`)
  console.error(`  当前 CLI 仅直接执行: ${BUILTIN_CLI_COMMANDS.join(', ')}`)
}

const scriptPath = resolve(SCRIPTS_DIR, script)

if (!existsSync(scriptPath)) {
  console.error(`  命令脚本不存在: ${scriptPath}`)
  process.exit(1)
}

try {
  process.argv = [process.argv[0], scriptPath, ...args.slice(1)]
  await import(scriptPath)
} catch (err) {
  console.error(`  执行失败: ${err.message}`)
  process.exit(1)
}
