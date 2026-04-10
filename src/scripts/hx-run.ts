#!/usr/bin/env node

/**
 * hx-run.js — 任务执行状态机
 *
 * 确定性工作：解析参数、定位 progressFile、获取下一批任务、输出精确指令。
 * AI 工作：实现具体任务内容（阶段二）。
 */

import { existsSync, readFileSync } from 'fs'
import { parseArgs } from './lib/config-utils.ts'
import { findProjectRoot, getSafeCwd } from './lib/resolve-context.ts'
import { resolveProgressFile, getRequirementDocPath, getActivePlanDocPath } from './lib/file-paths.ts'
import { validateProgressFile } from './lib/progress-schema.ts'
import { getRecoverableTasks, getRunnableTasks, getScheduledBatch } from './lib/task-scheduler.ts'

const argv = process.argv.slice(2)
const { positional, options } = parseArgs(argv)
const [feature] = positional

if (!feature) {
  console.error('用法: hx run <feature> [--plan-task <task-id>]')
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())
const planTaskId = options['plan-task'] ?? null

// 1. 定位 progressFile（自动从归档还原）
let filePath, restored
try {
  ;({ filePath, restored } = resolveProgressFile(projectRoot, feature))
} catch (err) {
  console.error(`❌ ${err.message}`)
  console.error(`   请先运行 hx plan ${feature}`)
  process.exit(1)
}

if (restored) {
  console.log(`ℹ️  progressFile 已从归档还原: ${filePath}\n`)
}

// 2. 校验 progressFile
const validation = validateProgressFile(filePath)
if (!validation.valid) {
  console.error('❌ progressFile 校验失败:')
  for (const e of validation.errors) console.error(`  • ${e}`)
  process.exit(1)
}

// 3. 计算下一批任务
const data = JSON.parse(readFileSync(filePath, 'utf8'))
let batch

if (planTaskId) {
  const task = data.tasks?.find((item) => item.id === planTaskId)
  if (!task) {
    console.error(`❌ task "${planTaskId}" 在 progressFile 中不存在`)
    process.exit(1)
  }

  if (task.status === 'done') {
    console.error(`❌ task "${planTaskId}" 已为 done，不能通过 --plan-task 重新执行`)
    process.exit(1)
  }

  const recoverableIds = new Set(getRecoverableTasks(data).map((item) => item.id))
  if (recoverableIds.has(planTaskId)) {
    batch = { tasks: [task], parallel: false, mode: 'recover' }
  } else {
    const runnableIds = new Set(getRunnableTasks(data).map((item) => item.id))
    if (!runnableIds.has(planTaskId)) {
      console.error(`❌ task "${planTaskId}" 当前不可执行：依赖未完成或状态非法`)
      process.exit(1)
    }
    batch = { tasks: [task], parallel: false, mode: 'run' }
  }
} else {
  batch = getScheduledBatch(data)
}

// 4. 输出
const reqDoc = getRequirementDocPath(projectRoot, feature)
const planDoc = getActivePlanDocPath(projectRoot, feature)

if (batch.mode === 'done') {
  console.log(`✅ feature "${feature}" 所有任务已完成`)
  console.log()
  console.log(`下一步: \`hx check ${feature}\``)
  process.exit(0)
}

const modeLabel = batch.mode === 'recover' ? '⚠️  恢复中断任务' : '▶  执行任务批次'
console.log(`## hx-run: ${modeLabel}`)
console.log()
console.log(`progressFile: \`${filePath}\``)
console.log(`planDoc:      \`${planDoc}\``)
if (existsSync(reqDoc)) console.log(`requirementDoc: \`${reqDoc}\``)
console.log()

if (batch.parallel && batch.tasks.length > 1) {
  console.log(`> **并行批次**: 为每个任务各开一个子 agent，同时执行。全部完成后再调用 \`hx run ${feature}\`。`)
  console.log()
}

for (const task of batch.tasks) {
  const taskLine = `### ${task.id} · ${task.name}`
  console.log(taskLine)
  console.log()

  if (batch.mode === 'recover') {
    console.log(`> 该任务上次被中断（status: in-progress），保留原 startedAt，直接进入阶段二实现。`)
    console.log()
  }

  console.log(`**阶段一 — 实现前，先调用（锁定 in-progress）：**`)
  console.log(`\`\`\`bash`)
  console.log(`hx progress start ${filePath} ${task.id}`)
  console.log(`\`\`\``)
  console.log()

  console.log(`**阶段二 — 实现任务内容：**`)
  console.log(`参见 \`${planDoc}\` 中 \`${task.id}\` 的实施要点，结合需求文档完成实现。`)
  console.log()

  console.log(`**阶段三 — 完成后，二选一调用：**`)
  console.log(`\`\`\`bash`)
  console.log(`# 成功`)
  console.log(
    `hx progress done ${filePath} ${task.id} --output "<一行完成摘要，≤200字符>"`,
  )
  console.log()
  console.log(`# 失败`)
  console.log(
    `hx progress fail ${filePath} ${task.id} --exit <failed|aborted|blocked|timeout> --reason "<原因>"`,
  )
  console.log(`\`\`\``)
  console.log()
}

console.log(`---`)
console.log(
  `完成本批次后，再次调用 \`hx run ${feature}\` 获取下一批任务，或查看 \`hx status ${feature}\`。`,
)
