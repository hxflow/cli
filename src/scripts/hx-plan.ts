#!/usr/bin/env node

/**
 * hx-plan.js — 执行计划生成上下文加载器
 *
 * 确定性工作：定位需求文档、解析 feature 头部、选择计划模板、输出精确路径和约束。
 * AI 工作：生成 planDoc 内容和 progressFile 的任务分解。
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { parseArgs } from './lib/config-utils.ts'
import { findProjectRoot, getSafeCwd, FRAMEWORK_ROOT } from './lib/resolve-context.ts'
import {
  getRequirementDocPath,
  getActivePlanDocPath,
  getActiveProgressFilePath,
} from './lib/file-paths.ts'
import { parseFeatureHeaderFile } from './lib/feature-header.ts'
import { getProgressSchemaPaths } from './lib/progress-schema.ts'

const argv = process.argv.slice(2)
const { positional } = parseArgs(argv)
const [feature] = positional

if (!feature) {
  console.error('用法: hx plan <feature>')
  process.exit(1)
}

const projectRoot = findProjectRoot(getSafeCwd())

// 1. 定位并验证需求文档
const requirementDoc = getRequirementDocPath(projectRoot, feature)
if (!existsSync(requirementDoc)) {
  console.error(`❌ 需求文档不存在: ${requirementDoc}`)
  console.error(`   请先运行 hx doc ${feature}`)
  process.exit(1)
}

// 2. 解析 feature 头部（固化解析，不由 AI 解释）
let parsedHeader
try {
  parsedHeader = parseFeatureHeaderFile(requirementDoc)
} catch (err) {
  console.error(`❌ 需求文档头部解析失败: ${err.message}`)
  process.exit(1)
}

// 3. 读取文档类型（> Type: 字段）
const reqContent = readFileSync(requirementDoc, 'utf8')
const typeMatch = reqContent.match(/^>\s*Type:\s*(.+)$/m)
const docType = typeMatch ? typeMatch[1].trim().toLowerCase() : 'feature'

// 4. 选择计划模板（项目层优先，回退框架层）
const templateName = docType === 'bugfix' ? 'bugfix-plan-template.md' : 'plan-template.md'
const projectTemplatePath = resolve(projectRoot, '.hx', 'rules', templateName)
const frameworkTemplatePath = resolve(FRAMEWORK_ROOT, 'templates', 'rules', templateName)
const templatePath = existsSync(projectTemplatePath) ? projectTemplatePath : frameworkTemplatePath

// 5. 检查现有产物
const planDoc = getActivePlanDocPath(projectRoot, feature)
const progressFile = getActiveProgressFilePath(projectRoot, feature)
const { schemaPath, templatePath: progressTemplatePath } = getProgressSchemaPaths()

if (existsSync(progressFile)) {
  console.warn(`⚠️  progressFile 已存在: ${progressFile}`)
  console.warn(`   继续执行将覆盖现有计划，请确认后继续。`)
  console.warn()
}

// 6. 输出精确的计划生成指令
console.log(`## hx-plan: 生成执行计划`)
console.log()
console.log(`**feature:** \`${parsedHeader.feature}\``)
if (parsedHeader.displayName) console.log(`**名称:** ${parsedHeader.displayName}`)
console.log(`**类型:** ${docType}`)
console.log()

console.log(`**输入文件:**`)
console.log(`- requirementDoc:    \`${requirementDoc}\``)
console.log(`- planTemplate:      \`${templatePath}\``)
console.log(`- progressTemplate:  \`${progressTemplatePath}\``)
console.log(`- progressSchema:    \`${schemaPath}\``)
console.log()

console.log(`**输出文件:**`)
console.log(`- planDoc:       \`${planDoc}\``)
console.log(`- progressFile:  \`${progressFile}\``)
console.log()

console.log(`**步骤:**`)
console.log(`1. 读取 requirementDoc，按 planTemplate 生成 planDoc`)
console.log(`2. 从需求中提取任务列表，按 progressTemplate/Schema 生成 progressFile`)
console.log(`   - 每个 task 必须包含: id, name, dependsOn[], parallelizable, output("")`)
console.log(`   - 依赖关系和并行标记写入 progressFile，不写入 planDoc`)
console.log(`3. 将 planDoc 写入 \`${planDoc}\`，progressFile 写入 \`${progressFile}\``)
console.log(`4. 校验: \`hx progress validate ${progressFile}\``)
console.log(`5. 新开子 agent 评审任务拆分质量（粒度、依赖、可并行性）`)
console.log(`6. 根据评审修正后，再次校验: \`hx progress validate ${progressFile}\``)
console.log()

console.log(`**约束:**`)
console.log(`- feature 值固定为 \`${parsedHeader.feature}\`，不允许重算或修改`)
console.log(`- progressFile 必须通过 \`hx progress validate\` 校验才算完成`)
console.log(`- planDoc 不写依赖关系和并行标记（只写任务内容）`)
