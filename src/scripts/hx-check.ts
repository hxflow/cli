#!/usr/bin/env node

/**
 * hx-check.js — 质量检查上下文加载器
 *
 * 确定性工作：加载 config.yaml 中的 gates、检查规则文件路径、输出精确检查指令。
 * AI 工作：review（代码审查）、clean（工程卫生扫描）的具体内容判断。
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { parseArgs, readTopLevelYamlScalar } from './lib/config-utils.ts'
import { findProjectRoot, getSafeCwd, FRAMEWORK_ROOT } from './lib/resolve-context.ts'

const VALID_SCOPES = ['review', 'qa', 'clean', 'all']
const GATE_ORDER = ['lint', 'build', 'type', 'test']

const argv = process.argv.slice(2)
const { options } = parseArgs(argv)
const scope = options.scope ?? 'all'

if (!VALID_SCOPES.includes(scope)) {
  console.error(`❌ --scope "${scope}" 无效，有效值: ${VALID_SCOPES.join(', ')}`)
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())

// 加载 .hx/config.yaml 中的 gates（不依赖 YAML 库，用正则提取嵌套值）
let gates = {}
try {
  const configPath = resolve(projectRoot, '.hx', 'config.yaml')
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf8')
    // 找到 gates: 块，提取其下的缩进键值对
    const gatesMatch = content.match(/^gates:\s*\n((?:[ \t]+\S[^\n]*\n?)*)/m)
    if (gatesMatch) {
      for (const line of gatesMatch[1].split('\n')) {
        const m = line.match(/^\s+(\w+):\s*(.*)/)
        if (m && m[2].trim()) {
          gates[m[1]] = m[2].trim()
        }
      }
    }
  }
} catch {
  gates = {}
}

// 规则文件路径（项目层优先）
function resolveRuleFile(name) {
  const project = resolve(projectRoot, '.hx', 'rules', name)
  const framework = resolve(FRAMEWORK_ROOT, 'templates', 'rules', name)
  if (existsSync(project)) return project
  if (existsSync(framework)) return framework
  return null
}

const reviewChecklist = resolveRuleFile('review-checklist.md')
const goldenRules = resolveRuleFile('golden-rules.md')

// ── 输出 ────────────────────────────────────────────────────

console.log(`## hx-check: 质量检查`)
console.log()
console.log(`**scope:** ${scope}`)
console.log()

const doReview = scope === 'review' || scope === 'all'
const doQa = scope === 'qa' || scope === 'all'
const doClean = scope === 'clean' || scope === 'all'

// ── review ──────────────────────────────────────────────────
if (doReview) {
  console.log(`### review — 代码审查`)
  console.log()
  if (reviewChecklist) {
    console.log(`检查清单: \`${reviewChecklist}\``)
  } else {
    console.log(`⚠️  未找到 review-checklist.md，使用通用审查原则。`)
  }
  if (goldenRules) {
    console.log(`规则文件: \`${goldenRules}\``)
  }
  console.log()
  console.log(`步骤:`)
  console.log(`1. 运行 \`git diff --stat HEAD\` 获取变更文件列表`)
  console.log(`2. 逐条对照检查清单执行机验项（可工具化执行的先行）`)
  console.log(`3. 执行人工审查项，输出问题列表（区分 blocker / warning / suggestion）`)
  console.log(`4. 若存在 blocker，输出具体修复建议，完成后运行 \`hx fix <feature>\``)
  console.log()
}

// ── qa ──────────────────────────────────────────────────────
if (doQa) {
  console.log(`### qa — 质量门`)
  console.log()

  const activeGates = GATE_ORDER.filter((g) => gates[g])
  if (activeGates.length === 0) {
    console.log(`ℹ️  .hx/config.yaml 中未配置任何 gate，跳过 qa。`)
  } else {
    console.log(`按顺序执行以下命令（任一非零 exit code 即失败）:`)
    console.log()
    console.log(`\`\`\`bash`)
    for (const gate of activeGates) {
      console.log(`# ${gate}`)
      console.log(gates[gate])
    }
    console.log(`\`\`\``)
    console.log()
    console.log(`通过标准：exit code === 0，不看命令输出文本。`)
  }
  console.log()
}

// ── clean ────────────────────────────────────────────────────
if (doClean) {
  console.log(`### clean — 工程卫生扫描`)
  console.log()
  console.log(`步骤（只扫描，不修改文件）:`)
  console.log(`1. 检查是否存在调试用代码（console.log、TODO、FIXME、hardcoded credentials）`)
  console.log(`2. 检查文档与代码的一致性（README、CHANGELOG、API 文档是否需要更新）`)
  console.log(`3. 检查未使用的导入、dead code、不一致的命名`)
  console.log(`4. 输出发现列表（分级: blocker / warning），不自动修改`)
  console.log()
}

// ── 完成后 ──────────────────────────────────────────────────
console.log(`---`)
console.log()
console.log(`**完成后:**`)
console.log(`- 存在 blocker → 运行 \`hx fix <feature>\` 或人工修复后重试`)
console.log(`- 全部通过 → 运行 \`hx mr <feature>\``)
