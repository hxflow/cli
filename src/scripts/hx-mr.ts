#!/usr/bin/env node

/**
 * hx-mr.js — MR 创建上下文收集器
 *
 * 确定性工作：定位 feature、读取 requirementDoc / progressFile、
 *             收集 git 事实、输出精确的 MR 生成指令。
 * AI 工作：生成 MR 标题和 Markdown 描述。
 */

import { existsSync, readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { resolve } from 'path'
import { parseArgs } from './lib/config-utils.ts'
import { findProjectRoot, getSafeCwd } from './lib/resolve-context.ts'
import {
  getRequirementDocPath,
  getActivePlanDocPath,
  getActiveProgressFilePath,
  getArchiveDirPath,
} from './lib/file-paths.ts'
import { parseFeatureHeaderFile } from './lib/feature-header.ts'

const argv = process.argv.slice(2)
const { positional, options } = parseArgs(argv)
const [feature] = positional
const targetBranch = options.target ?? null
const project = options.project ?? null

if (!feature) {
  console.error('用法: hx mr <feature> [--target <branch>] [--project <group/repo>]')
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())

// 1. 定位需求文档
const requirementDoc = getRequirementDocPath(projectRoot, feature)
if (!existsSync(requirementDoc)) {
  console.error(`❌ 需求文档不存在: ${requirementDoc}`)
  process.exit(1)
}

// 2. 解析 feature 头部
let parsedHeader
try {
  parsedHeader = parseFeatureHeaderFile(requirementDoc)
} catch (err) {
  console.error(`❌ 需求文档头部解析失败: ${err.message}`)
  process.exit(1)
}

// 3. 定位 progressFile（活跃或归档）
const activeProgressFile = getActiveProgressFilePath(projectRoot, feature)
const archiveDir = getArchiveDirPath(projectRoot, feature)
const archivedProgressFile = resolve(archiveDir, `${feature}-progress.json`)

let progressFile = null
if (existsSync(activeProgressFile)) {
  progressFile = activeProgressFile
} else if (existsSync(archivedProgressFile)) {
  progressFile = archivedProgressFile
}

if (!progressFile) {
  console.error(`❌ progressFile 不存在（活跃或归档均未找到）`)
  console.error(`   请先运行 hx run ${feature} 完成所有任务`)
  process.exit(1)
}

// 4. 收集进度摘要
let progressSummary = '（无法读取）'
let allDone = false
try {
  const data = JSON.parse(readFileSync(progressFile, 'utf8'))
  const tasks = data.tasks ?? []
  allDone = tasks.length > 0 && tasks.every((t) => t.status === 'done')
  const doneCount = tasks.filter((t) => t.status === 'done').length
  progressSummary = `${doneCount}/${tasks.length} 个任务完成`
  if (!allDone) {
    const pendingIds = tasks.filter((t) => t.status !== 'done').map((t) => t.id)
    console.warn(`⚠️  存在未完成任务: ${pendingIds.join(', ')}`)
    console.warn(`   建议先运行 \`hx run ${feature}\` 完成所有任务。`)
    console.warn()
  }
} catch {
  console.warn(`⚠️  无法解析 progressFile: ${progressFile}`)
}

// 5. 收集 git 事实
function runGit(...gitArgs) {
  const result = spawnSync('git', gitArgs, { cwd: projectRoot, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

const defaultBranch =
  targetBranch ??
  runGit('symbolic-ref', '--short', 'refs/remotes/origin/HEAD')?.replace('origin/', '') ??
  'main'
const currentBranch = runGit('rev-parse', '--abbrev-ref', 'HEAD') ?? '（无法获取）'
const gitLog = runGit('log', `${defaultBranch}..HEAD`, '--oneline') ?? '（无法获取）'
const gitDiffStat = runGit('diff', `${defaultBranch}...HEAD`, '--stat') ?? '（无法获取）'

// 6. planDoc 路径
const planDoc = existsSync(getActivePlanDocPath(projectRoot, feature))
  ? getActivePlanDocPath(projectRoot, feature)
  : resolve(archiveDir, `${feature}.md`)

// 7. 输出精确的 MR 生成指令
console.log(`## hx-mr: 生成 Merge Request`)
console.log()
console.log(`**feature:** \`${parsedHeader.feature}\``)
if (parsedHeader.displayName) console.log(`**名称:** ${parsedHeader.displayName}`)
if (parsedHeader.sourceId) console.log(`**来源:** ${parsedHeader.sourceId}`)
console.log()

console.log(`**输入文件:**`)
console.log(`- requirementDoc: \`${requirementDoc}\``)
console.log(`- planDoc:        \`${planDoc}\``)
console.log(`- progressFile:   \`${progressFile}\`  (${progressSummary})`)
console.log()

console.log(`**git 事实:**`)
console.log(`- 当前分支: \`${currentBranch}\``)
console.log(`- 目标分支: \`${defaultBranch}\``)
if (project) console.log(`- 项目: \`${project}\``)
console.log()

console.log(`\`git log ${defaultBranch}..HEAD --oneline\`:`)
console.log(`\`\`\``)
console.log(gitLog || '（无提交）')
console.log(`\`\`\``)
console.log()

console.log(`\`git diff ${defaultBranch}...HEAD --stat\`:`)
console.log(`\`\`\``)
console.log(gitDiffStat || '（无变更）')
console.log(`\`\`\``)
console.log()

console.log(`**步骤:**`)
console.log(`1. 读取 requirementDoc（背景、目标、验收标准）`)
console.log(`2. 读取 progressFile（任务完成状态与输出摘要）`)
console.log(`3. 结合 git 事实，生成 MR 标题和 Markdown 描述`)
console.log(`   - 描述需涵盖: 需求背景、变更说明、AC 验收清单、任务完成情况、测试说明`)
console.log(`4. 输出 MR 标题（单行）`)
console.log(`5. 输出 Markdown 描述（可直接粘贴到平台）`)
console.log(`6. 归档: \`hx archive ${feature}\``)
console.log(`   （hx archive 会校验所有 task 均为 done 后再执行移动）`)
console.log()

if (!allDone) {
  console.warn(`⚠️  当前存在未完成任务，hx archive 会失败。建议先补齐 progressFile。`)
}

console.log(`---`)
console.log()
console.log(`**约束:**`)
console.log(`- feature 只读取已有值 \`${parsedHeader.feature}\`，不允许在 MR 阶段重算`)
console.log(`- 归档路径固定: \`docs/archive/${feature}/\`，不允许自定义`)
