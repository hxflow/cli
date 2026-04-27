#!/usr/bin/env bun
/**
 * 用 claude CLI 驱动 eval cases，产出 results.json，然后调 score。
 *
 * 用法：
 *   bun hxflow/evals/run-evals.ts [--spec default] [--record] [--assert-thresholds]
 *
 * 选项：
 *   --spec <name>         指定评测组合，默认 "default"
 *   --record              评测后写入 runs/history.json
 *   --assert-thresholds   通过率不达标时以 exit 1 退出
 *   --max-turns <n>       每条 case claude -p 的最大轮次，默认 5
 *   --out <path>          结果文件输出路径，默认 /tmp/hx-eval-results.json
 *   --run-out <path>      score run 文件路径，默认 /tmp/hx-eval-run.json
 *   --summary <path>      Markdown 摘要输出路径（可选）
 */

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parseArgs } from '../scripts/lib/config-utils.ts'

// ---- types ----
interface EvalCase {
  id: string
  input: string
  tags?: string[]
}

interface EvalResultItem {
  id: string
  output: string
  toolCalls: []
  metadata?: Record<string, unknown>
}

// ---- helpers ----
function readJsonl(filePath: string): unknown[] {
  return readFileSync(filePath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l))
}

function loadCases(rootDir: string, specName: string): EvalCase[] {
  const specPath = resolve(rootDir, 'hxflow/evals/specs', `${specName}.json`)
  if (!existsSync(specPath)) throw new Error(`spec 不存在：${specPath}`)

  const spec = JSON.parse(readFileSync(specPath, 'utf8')) as { datasets: string[] }
  const cases: EvalCase[] = []

  for (const dataset of spec.datasets) {
    const p = resolve(rootDir, 'hxflow/evals/datasets', `${dataset}.jsonl`)
    if (!existsSync(p)) throw new Error(`dataset 不存在：${p}`)
    const rows = readJsonl(p) as EvalCase[]
    cases.push(...rows)
  }

  return cases
}

/**
 * 构建注入给 claude 的系统上下文：SKILL.md + 所有命令契约 + 评测模式说明。
 * 评测模式说明确保 claude 只描述意图，不执行任何实际操作。
 */
function buildSystemContext(rootDir: string): string {
  const parts: string[] = []

  const skillMd = resolve(rootDir, 'hxflow/SKILL.md')
  if (existsSync(skillMd)) {
    parts.push(`# Skill 入口\n${readFileSync(skillMd, 'utf8').trim()}`)
  }

  const commandsDir = resolve(rootDir, 'hxflow/commands')
  if (existsSync(commandsDir)) {
    const files = readdirSync(commandsDir)
      .filter((f) => f.endsWith('.md'))
      .sort()
    for (const f of files) {
      const content = readFileSync(resolve(commandsDir, f), 'utf8').trim()
      parts.push(`# ${f}\n${content}`)
    }
  }

  parts.push(`# 评测模式说明

你当前处于自动化评测环境中。规则：
1. 只输出文字回答，不要执行任何操作（读写文件、运行命令等）。
2. 回答时必须直接引用上方命令契约中的原文表述，不要改写、摘要或简化关键约束。
3. 如果问题涉及代码结构变更，列出应修改的文件路径即可，不要尝试实际修改。`)

  return parts.join('\n\n---\n\n')
}

function runCase(
  input: string,
  maxTurns: number,
  systemContext: string,
): { output: string; durationMs: number } {
  const start = Date.now()
  // CI 环境（有 ANTHROPIC_API_KEY）用 --bare 跳过 OAuth/keychain
  const isCi = Boolean(process.env.CI || process.env.ANTHROPIC_API_KEY)
  const result = spawnSync(
    'claude',
    [
      '-p', input,
      '--output-format', 'text',
      '--max-turns', String(maxTurns),
      '--append-system-prompt', systemContext,
      '--tools', '',
      ...(isCi ? ['--bare'] : []),
    ],
    { encoding: 'utf8', timeout: 120_000 },
  )
  if (result.error) throw result.error
  return { output: (result.stdout ?? '').trim(), durationMs: Date.now() - start }
}

// ---- main ----
const cwd = process.cwd()
const { options } = parseArgs(process.argv.slice(2))

const specName = typeof options.spec === 'string' ? options.spec : 'default'
const maxTurns = typeof options['max-turns'] === 'string' ? parseInt(options['max-turns'], 10) : 5
const outPath = typeof options.out === 'string' ? resolve(cwd, options.out) : '/tmp/hx-eval-results.json'
const runOutPath = typeof options['run-out'] === 'string' ? resolve(cwd, options['run-out']) : '/tmp/hx-eval-run.json'
const summaryPath = typeof options.summary === 'string' ? resolve(cwd, options.summary) : undefined
const record = options.record === true
const assertThresholds = options['assert-thresholds'] === true

const cases = loadCases(cwd, specName)
const systemContext = buildSystemContext(cwd)
console.error(`[run-evals] spec=${specName}  cases=${cases.length}  max-turns=${maxTurns}`)
console.error(`[run-evals] system context: ${systemContext.length} chars`)

const results: EvalResultItem[] = []

for (const c of cases) {
  process.stderr.write(`  [${c.id}] 运行中...`)
  try {
    const { output, durationMs } = runCase(c.input, maxTurns, systemContext)
    results.push({ id: c.id, output, toolCalls: [], metadata: { durationMs } })
    process.stderr.write(` ✓ ${durationMs}ms\n`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    results.push({ id: c.id, output: '', toolCalls: [], metadata: { error: msg } })
    process.stderr.write(` ✗ 失败: ${msg.slice(0, 80)}\n`)
  }
}

writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8')
console.error(`[run-evals] 结果已写入 ${outPath}`)

// ---- score ----
const evalsTs = resolve(cwd, 'hxflow/scripts/lib/evals.ts')
const scoreArgs = [
  `bun ${evalsTs} score ${outPath}`,
  `--spec ${specName}`,
  `--write-run ${runOutPath}`,
  summaryPath ? `--write-summary ${summaryPath}` : '',
  record ? '--record' : '',
  assertThresholds ? '--assert-thresholds' : '',
].filter(Boolean).join(' ')

console.error(`[run-evals] 打分中...`)
try {
  const scoreOutput = execSync(scoreArgs, { encoding: 'utf8', cwd })
  console.log(scoreOutput)
} catch (e) {
  if (e && typeof e === 'object' && 'stdout' in e) {
    process.stdout.write(String((e as NodeJS.ErrnoException & { stdout?: string }).stdout ?? ''))
  }
  process.exit(1)
}
