/**
 * hx-init.ts — 项目初始化 orchestrator
 *
 * 幂等：完整已初始化 → no-op；部分缺失 → 仅补全缺失部分。
 * 确定性工作：检测初始化状态、写 .hx/config.yaml 和规则模板。
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { resolve } from 'path'

import { FRAMEWORK_ROOT } from '../lib/resolve-context.ts'
import { createSimpleContext } from '../lib/tool-cli.ts'

const { projectRoot } = createSimpleContext()
const hxDir = resolve(projectRoot, '.hx')
const configPath = resolve(hxDir, 'config.yaml')
const rulesDir = resolve(hxDir, 'rules')
const frameworkRulesDir = resolve(FRAMEWORK_ROOT, 'templates', 'rules')
const frameworkConfigTemplate = resolve(FRAMEWORK_ROOT, 'templates', 'config.yaml')

// ── 1. 检测初始化状态 ─────────────────────────────────────────────────────────

const REQUIRED_RULE_FILES = listFrameworkRuleFiles(frameworkRulesDir)
const initStatus = detectInitStatus()

if (initStatus.complete) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        status: 'complete',
        message: '当前项目已完整初始化，无需再次执行 hx-init。',
        missing: [],
        nextAction: 'hx doc <feature>',
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

// ── 2. 配置模板（纯模板复制，无需 AI）────────────────────────────────────────
const written: string[] = []

mkdirSync(hxDir, { recursive: true })

if (!existsSync(configPath) && existsSync(frameworkConfigTemplate)) {
  writeFileSync(configPath, readFileSync(frameworkConfigTemplate, 'utf8'), 'utf8')
  written.push(configPath)
}

// ── 3. 规则模板（纯模板复制，无需 AI）────────────────────────────────────────

mkdirSync(rulesDir, { recursive: true })

for (const file of REQUIRED_RULE_FILES) {
  const dest = resolve(rulesDir, file)
  const src = resolve(frameworkRulesDir, file)
  if (!existsSync(dest) && existsSync(src)) {
    writeFileSync(dest, readFileSync(src, 'utf8'), 'utf8')
    written.push(dest)
  }
}

console.log(JSON.stringify({
  ok: true,
  status: written.length > 0 ? 'initialized' : 'complete',
  missing: [],
  written,
  nextAction: 'hx doc <feature>',
}, null, 2))

// ── helpers ───────────────────────────────────────────────────────────────────

interface InitStatus {
  complete: boolean
  missing: string[]
}

function detectInitStatus(): InitStatus {
  const missing: string[] = []

  if (!existsSync(configPath)) missing.push('config')

  for (const rf of REQUIRED_RULE_FILES) {
    if (!existsSync(resolve(rulesDir, rf))) missing.push(`rules/${rf}`)
  }

  return { complete: missing.length === 0, missing }
}

function listFrameworkRuleFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
}
