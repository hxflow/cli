#!/usr/bin/env node

/**
 * hx-go.js — 全自动流水线状态机
 *
 * 确定性工作：检测当前流水线阶段、输出下一步命令。
 * AI 工作：由各子命令（hx plan / hx run / hx check / hx mr）分别负责。
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { parseArgs } from './lib/config-utils.ts'
import { findProjectRoot, getSafeCwd } from './lib/resolve-context.ts'
import {
  getRequirementDocPath,
  getActivePlanDocPath,
  getActiveProgressFilePath,
  getArchiveDirPath,
} from './lib/file-paths.ts'
import { validateProgressData } from './lib/progress-schema.ts'

const PIPELINE_STEPS = ['doc', 'plan', 'run', 'check', 'mr']

const argv = process.argv.slice(2)
const { positional, options } = parseArgs(argv)
const [feature] = positional
const fromStep = options.from ?? null
const pipelineName = options.pipeline ?? 'default'

if (!feature) {
  console.error('用法: hx go <feature> [--from <step>] [--pipeline <name>]')
  console.error(`       steps: ${PIPELINE_STEPS.join(' → ')}`)
  process.exit(1)
}

if (pipelineName !== 'default') {
  console.error(`⚠️  自定义 pipeline 尚未支持，当前只支持 default pipeline。`)
  process.exit(1)
}

if (fromStep && !PIPELINE_STEPS.includes(fromStep)) {
  console.error(`❌ --from "${fromStep}" 不是有效的 step`)
  console.error(`   有效 step: ${PIPELINE_STEPS.join(', ')}`)
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())

// ── 检测各阶段完成状态 ──────────────────────────────────────

function isDocDone() {
  return existsSync(getRequirementDocPath(projectRoot, feature))
}

function isPlanDone() {
  const active = getActiveProgressFilePath(projectRoot, feature)
  const archived = resolve(getArchiveDirPath(projectRoot, feature), `${feature}-progress.json`)
  return existsSync(active) || existsSync(archived)
}

function isRunDone() {
  // 已归档 = run 完成
  const archived = resolve(getArchiveDirPath(projectRoot, feature), `${feature}-progress.json`)
  if (existsSync(archived)) return true

  // 活跃 progressFile：检查所有 task 是否均为 done
  const active = getActiveProgressFilePath(projectRoot, feature)
  if (!existsSync(active)) return false
  try {
    const data = JSON.parse(readFileSync(active, 'utf8'))
    const result = validateProgressData(data)
    if (!result.valid) return false
    return data.tasks?.every((t) => t.status === 'done') ?? false
  } catch {
    return false
  }
}

// check / mr 总是重新执行（没有持久化完成标记）

// ── 确定起点 ────────────────────────────────────────────────

let startStep
if (fromStep) {
  startStep = fromStep
} else {
  // 自动判断最早未完成 step
  if (!isDocDone()) {
    startStep = 'doc'
  } else if (!isPlanDone()) {
    startStep = 'plan'
  } else if (!isRunDone()) {
    startStep = 'run'
  } else {
    startStep = 'check'
  }
}

const startIndex = PIPELINE_STEPS.indexOf(startStep)

// ── 输出 ────────────────────────────────────────────────────

console.log(`## hx-go: pipeline 状态检测`)
console.log()
console.log(`**feature:** \`${feature}\``)
console.log(`**pipeline:** ${pipelineName}`)
console.log(`**steps:** ${PIPELINE_STEPS.join(' → ')}`)
console.log()

if (!fromStep) {
  console.log(`**阶段完成状态:**`)
  console.log(`- doc:  ${isDocDone() ? '✅ done' : '⬜ pending'}`)
  console.log(`- plan: ${isPlanDone() ? '✅ done' : '⬜ pending'}`)
  console.log(`- run:  ${isRunDone() ? '✅ done' : '⬜ pending'}`)
  console.log(`- check: 🔄 always re-run`)
  console.log(`- mr:    🔄 always re-run`)
  console.log()
}

console.log(`**当前起点:** \`${startStep}\``)
console.log(`**待执行步骤:** ${PIPELINE_STEPS.slice(startIndex).join(' → ')}`)
console.log()
console.log(`---`)
console.log()

const nextStep = PIPELINE_STEPS[startIndex]
console.log(`**下一步，执行:**`)
console.log()
console.log(`\`\`\`bash`)
console.log(`hx ${nextStep} ${feature}`)
console.log(`\`\`\``)
console.log()

if (PIPELINE_STEPS.slice(startIndex).length > 1) {
  console.log(`完成后，继续调用 \`hx go ${feature}${fromStep ? `` : ''}\` 或逐步执行后续 step。`)
}
