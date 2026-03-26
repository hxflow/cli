import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// ── CLAUDE.md 标记块 ──────────────────────────────────────────────────────────

export const HARNESS_MARKER_START = '<!-- hxflow:start -->'
export const HARNESS_MARKER_END = '<!-- hxflow:end -->'

export function buildHarnessBlock(profile) {
  return `${HARNESS_MARKER_START}
## Harness Workflow

本项目已启用 Harness Workflow Framework。

- 配置: \`.hx/config.yaml\`
- Profile: \`${profile}\`
- 需求文档: \`docs/requirement/\`
- 执行计划: \`docs/plans/\`
- Agent 索引: \`AGENTS.md\`

可用命令: \`/hx-go\` \`/hx-doc\` \`/hx-plan\` \`/hx-run\` \`/hx-review\` \`/hx-gate\` \`/hx-entropy\` \`/hx-mr\`

执行规则和上下文详见 \`AGENTS.md\`
${HARNESS_MARKER_END}`
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── 转发器生成 ────────────────────────────────────────────────────────────────

/**
 * 在 targetDir 中为 sourceDir 里每个 hx-*.md 命令文件生成转发器。
 *
 * 转发器不包含命令逻辑，只写三层查找路径，由 Claude 在运行时按优先级读取实体文件执行。
 * frameworkRoot 是框架安装目录的绝对路径，在 setup 时写死到转发器内容中。
 *
 * opts.createDir   true → 目标目录不存在时自动创建
 * opts.dryRun      true → 只报告，不实际写入
 */
export function generateForwarderFiles(sourceDir, targetDir, frameworkRoot, userHxDir, summary, opts = {}) {
  const { createDir = false, dryRun = false } = opts

  if (!existsSync(sourceDir)) {
    summary.warnings.push('框架命令目录不存在，跳过转发器生成')
    return
  }

  if (!existsSync(targetDir)) {
    if (createDir) {
      if (!dryRun) mkdirSync(targetDir, { recursive: true })
    } else {
      summary.warnings.push('~/.claude/commands/ 目录不存在，请先运行 hx setup')
      return
    }
  }

  const files = readdirSync(sourceDir).filter((f) => f.startsWith('hx-') && f.endsWith('.md'))

  for (const file of files) {
    const commandName = file.replace(/\.md$/, '')
    const dstPath = resolve(targetDir, file)
    const label = `~/.claude/commands/${file}`

    const content = buildForwarderContent(commandName, frameworkRoot, userHxDir)
    const existing = existsSync(dstPath) ? readFileSync(dstPath, 'utf8') : null

    if (existing === content) {
      summary.skipped.push(`${label} (无变化)`)
      continue
    }

    if (!dryRun) writeFileSync(dstPath, content, 'utf8')
    summary[existing ? 'updated' : 'created'].push(label)
  }
}

function buildForwarderContent(commandName, frameworkRoot, userHxDir) {
  const systemPath = resolve(frameworkRoot, 'agents', 'commands', `${commandName}.md`)
  return `<!-- hx-forwarder: ${commandName} — 由 hx setup 自动生成，请勿手动修改 -->

按以下优先级找到第一个存在的文件，读取其完整内容作为指令执行（$ARGUMENTS 原样透传）：

1. 从当前目录向上查找含 \`.hx/config.yaml\` 或 \`.git\` 的项目根目录，读取 \`<项目根>/.hx/commands/${commandName}.md\`
2. \`${userHxDir}/commands/${commandName}.md\`
3. \`${systemPath}\`

若三处均不存在，报错：\`${commandName} 命令实体文件未找到，请运行 hx setup 修复。\`
`
}

// ── Skills 同步 ───────────────────────────────────────────────────────────────

export function syncSkillDirs(sourceDir, targetDir, summary, opts = {}) {
  const { createDir = false, overwrite = false, dryRun = false } = opts

  if (!existsSync(sourceDir)) {
    if (overwrite) summary.warnings.push('框架 skills 目录不存在，跳过 skills 升级')
    return
  }

  const skills = readdirSync(sourceDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  if (skills.length === 0) return

  if (!existsSync(targetDir)) {
    if (createDir) {
      mkdirSync(targetDir, { recursive: true })
    } else {
      summary.warnings.push('.claude/skills/ 目录不存在，请先运行 hx init')
      return
    }
  }

  for (const skill of skills) {
    const srcSkillDir = resolve(sourceDir, skill)
    const dstSkillDir = resolve(targetDir, skill)
    const label = `.claude/skills/${skill}/`

    if (!existsSync(dstSkillDir)) {
      if (!dryRun) cpSync(srcSkillDir, dstSkillDir, { recursive: true })
      if (overwrite) summary.updated.push(`${label} (新增)`)
      else summary.created.push(label)
      continue
    }

    if (!overwrite) {
      summary.skipped.push(`${label} (已存在)`)
      continue
    }

    const srcFiles = readdirSync(srcSkillDir, { recursive: true })
      .filter((f) => typeof f === 'string' && statSync(resolve(srcSkillDir, f)).isFile())
    let changed = false
    for (const file of srcFiles) {
      if (!existsSync(resolve(dstSkillDir, file))) { changed = true; break }
      if (readFileSync(resolve(srcSkillDir, file)).toString() !== readFileSync(resolve(dstSkillDir, file)).toString()) {
        changed = true; break
      }
    }

    if (changed) {
      if (!dryRun) cpSync(srcSkillDir, dstSkillDir, { recursive: true })
      summary.updated.push(label)
    } else {
      summary.skipped.push(`${label} (无变化)`)
    }
  }
}
