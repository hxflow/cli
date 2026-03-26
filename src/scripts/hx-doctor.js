#!/usr/bin/env node

/**
 * hx doctor — 健康检测
 *
 * 检测内容：
 *   1. 运行环境（node 版本、hx 安装）
 *   2. 全局安装（~/.hx/profiles、~/.claude/commands）
 *   3. 当前项目（.hx/config.yaml、AGENTS.md、docs/）
 *   4. Profile 健康（能否加载、gate_commands 是否配置）
 */

import { existsSync, readFileSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'
import { createRequire } from 'module'

import { FRAMEWORK_ROOT } from './lib/resolve-context.js'

const require = createRequire(import.meta.url)

// ── 收集结果 ──────────────────────────────────────────────────────

const issues = []
const div = '─'.repeat(48)

function ok(msg)   { console.log(`  ✓ ${msg}`) }
function fail(msg) { console.log(`  ✗ ${msg}`); issues.push(msg) }
function warn(msg) { console.log(`  ⚠ ${msg}`) }
function section(title) { console.log(`\n── ${title} ${div.slice(title.length + 4)}`) }

// ── 环境 ──────────────────────────────────────────────────────────

section('环境')

const nodeVersion = process.versions.node.split('.').map(Number)
if (nodeVersion[0] >= 18) {
  ok(`node v${process.versions.node}`)
} else {
  fail(`node v${process.versions.node}（需要 >= 18）`)
}

try {
  const pkg = require(resolve(FRAMEWORK_ROOT, '..', 'package.json'))
  ok(`hx v${pkg.version}`)
} catch {
  warn('无法读取版本信息')
}

// ── 全局安装 ──────────────────────────────────────────────────────

section('全局安装')

const HX_DIR     = resolve(homedir(), '.hx')
const CLAUDE_DIR = resolve(homedir(), '.claude')

const requiredProfiles = ['base', 'backend', 'frontend', 'mobile']
for (const name of requiredProfiles) {
  const p = resolve(FRAMEWORK_ROOT, 'profiles', name)
  existsSync(p) ? ok(`profiles/${name}/`) : fail(`profiles/${name}/ 缺失（系统层损坏，检查 ${FRAMEWORK_ROOT}）`)
}

const commandsDir = resolve(CLAUDE_DIR, 'commands')
if (existsSync(commandsDir)) {
  const commands = readdirSync(commandsDir).filter(f => f.startsWith('hx-') && f.endsWith('.md'))
  if (commands.length > 0) {
    ok(`~/.claude/commands/（${commands.length} 个命令）`)
  } else {
    fail('~/.claude/commands/ 存在但无 hx-*.md 命令，运行 hx setup 修复')
  }
} else {
  fail('~/.claude/commands/ 缺失，运行 hx setup 修复')
}

// ── 当前项目 ──────────────────────────────────────────────────────

section('当前项目')

const ROOT = process.cwd()
const hxConfig = resolve(ROOT, '.hx', 'config.yaml')

if (!existsSync(hxConfig)) {
  warn('.hx/config.yaml 不存在（未初始化，在 Claude Code 中运行 /hx-init）')
} else {
  ok('.hx/config.yaml')

  let config = {}
  try {
    const { parseSimpleYaml } = await import('./lib/profile-utils.js')
    config = parseSimpleYaml(readFileSync(hxConfig, 'utf8'))
    ok(`.hx/config.yaml · profile: ${config.defaultProfile || '未设置'}`)
  } catch {
    fail('.hx/config.yaml 格式错误')
  }

  // 项目文件检查
  const projectFiles = [
    ['AGENTS.md', 'AGENTS.md'],
    ['docs/requirement/', 'docs/requirement/'],
    ['docs/plans/', 'docs/plans/'],
    ['.claude/commands/', '.claude/commands/'],
  ]
  for (const [path, label] of projectFiles) {
    existsSync(resolve(ROOT, path.replace(/\/$/, '')))
      ? ok(label)
      : warn(`${label} 缺失`)
  }

  // Profile 健康
  if (config.defaultProfile) {
    section(`Profile · ${config.defaultProfile}`)
    try {
      const { loadProfile } = await import('./lib/profile-utils.js')
      const { buildProfileSearchRoots } = await import('./lib/resolve-context.js')
      const profile = loadProfile(FRAMEWORK_ROOT, config.defaultProfile, {
        searchRoots: buildProfileSearchRoots(ROOT)
      })
      ok(`${profile.profile} 加载正常`)

      const gates = Object.entries(profile.gateCommands || {}).filter(([, v]) => v)
      if (gates.length > 0) {
        ok(`gate_commands: ${gates.map(([k]) => k).join(', ')}`)
      } else {
        warn('gate_commands 未配置，编辑 .hx/profiles/' + config.defaultProfile + '/profile.yaml')
      }
    } catch (err) {
      fail(`Profile 加载失败: ${err.message}`)
    }
  }
}

// ── 结果 ──────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(48)}`)
if (issues.length === 0) {
  console.log('  ✓ 一切正常\n')
} else {
  console.log(`  ${issues.length} 个问题需要修复\n`)
  process.exit(1)
}
