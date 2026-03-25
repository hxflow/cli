import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, statSync, symlinkSync } from 'fs'
import { isAbsolute, relative, resolve } from 'path'
import { tmpdir } from 'os'
import { env } from 'process'

// ── CLAUDE.md 标记块 ──────────────────────────────────────────────────────────

export const HARNESS_MARKER_START = '<!-- harness-workflow:start -->'
export const HARNESS_MARKER_END = '<!-- harness-workflow:end -->'

export function buildHarnessBlock(profile) {
  return `${HARNESS_MARKER_START}
## Harness Workflow

本项目已启用 Harness Workflow Framework。

- 配置: \`.hx/config.json\`
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

// ── 命令文件 / Skills 同步 ────────────────────────────────────────────────────
//
// opts.createDir      true → 目标目录不存在时自动创建（init 模式）
//                     false → 目标目录不存在时记录警告并退出（upgrade 模式）
// opts.overwrite      false → 文件已存在则跳过（init 模式）
//                     true  → 内容有变化则覆盖（upgrade 模式）
// opts.dryRun         true  → 只报告，不实际写入
// opts.pinnedCommands Set<string> → 命令名（不含 .md）列表，upgrade 时跳过这些文件

export function syncCommandFiles(sourceDir, targetDir, summary, opts = {}) {
  const { createDir = false, overwrite = false, dryRun = false, pinnedCommands = new Set() } = opts

  if (!existsSync(sourceDir)) {
    summary.warnings.push('框架命令目录不存在，跳过命令升级')
    return
  }

  if (!existsSync(targetDir)) {
    if (createDir) {
      mkdirSync(targetDir, { recursive: true })
    } else {
      summary.warnings.push('.claude/commands/ 目录不存在，请先运行 hx init')
      return
    }
  }

  const files = readdirSync(sourceDir).filter((f) => f.startsWith('hx-') && f.endsWith('.md'))

  for (const file of files) {
    const srcPath = resolve(sourceDir, file)
    const dstPath = resolve(targetDir, file)
    const label = `.claude/commands/${file}`
    const commandName = file.replace(/\.md$/, '')

    if (overwrite && pinnedCommands.has(commandName)) {
      summary.skipped.push(`${label} (已固定，跳过升级)`)
      continue
    }

    if (!existsSync(dstPath)) {
      if (!dryRun) cpSync(srcPath, dstPath)
      if (overwrite) summary.updated.push(`${label} (新增)`)
      else summary.created.push(label)
      continue
    }

    if (!overwrite) {
      summary.skipped.push(`${label} (已存在)`)
      continue
    }

    const srcContent = readFileSync(srcPath, 'utf8')
    const dstContent = readFileSync(dstPath, 'utf8')
    if (srcContent === dstContent) {
      summary.skipped.push(`${label} (无变化)`)
    } else {
      if (!dryRun) cpSync(srcPath, dstPath)
      summary.updated.push(label)
    }
  }
}

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

/**
 * 同步框架 profiles 到用户目录（~/.hx/profiles/）。
 *
 * opts.overwrite  false → 跳过已存在的目录（setup 首次安装）
 *                 true  → 内容有变化则覆盖（upgrade 模式）
 * opts.dryRun     true  → 只报告，不实际写入
 */
export function syncProfilesToUserDir(sourceProfilesDir, targetProfilesDir, summary, opts = {}) {
  const { overwrite = false, dryRun = false } = opts

  if (!existsSync(sourceProfilesDir)) {
    summary.warnings.push('框架 profiles 目录不存在，跳过')
    return
  }

  if (!existsSync(targetProfilesDir)) {
    if (!dryRun) mkdirSync(targetProfilesDir, { recursive: true })
  }

  const profiles = readdirSync(sourceProfilesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  for (const name of profiles) {
    const srcDir = resolve(sourceProfilesDir, name)
    const dstDir = resolve(targetProfilesDir, name)
    const label = `profiles/${name}/`

    if (!existsSync(dstDir)) {
      if (!dryRun) cpSync(srcDir, dstDir, { recursive: true })
      if (overwrite) summary.updated.push(`${label} (新增)`)
      else summary.created.push(label)
      continue
    }

    if (!overwrite) {
      summary.skipped.push(`${label} (已存在)`)
      continue
    }

    // 检查是否有变化
    const srcFiles = readdirSync(srcDir, { recursive: true })
      .filter((f) => typeof f === 'string' && statSync(resolve(srcDir, f)).isFile())
    let changed = false
    for (const file of srcFiles) {
      if (!existsSync(resolve(dstDir, file))) { changed = true; break }
      if (readFileSync(resolve(srcDir, file)).toString() !== readFileSync(resolve(dstDir, file)).toString()) {
        changed = true; break
      }
    }

    if (changed) {
      if (!dryRun) cpSync(srcDir, dstDir, { recursive: true })
      summary.updated.push(label)
    } else {
      summary.skipped.push(`${label} (无变化)`)
    }
  }
}

export function collectTokenStatuses(root) {
  return [
    {
      label: 'GitLab Token',
      recommendedKey: 'GITLAB_TOKEN',
      matched: findConfiguredKey(root, ['GITLAB_TOKEN'])
    },
    {
      label: '无双 DevOps API Token',
      recommendedKey: 'DEVOPS_API_KEY',
      matched: findConfiguredKey(root, ['DEVOPS_API_KEY', 'WUSHUANG_API_TOKEN'])
    }
  ]
}

export function findConfiguredKey(root, keys) {
  for (const key of keys) {
    if (env[key]) {
      return { key, source: 'env' }
    }
  }

  const envFiles = ['.env', '.env.local', '.env.development', '.env.development.local', '.envrc']
  for (const fileName of envFiles) {
    const filePath = resolve(root, fileName)
    if (!existsSync(filePath)) {
      continue
    }

    const content = readFileSync(filePath, 'utf8')
    for (const key of keys) {
      const matcher = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`, 'm')
      if (matcher.test(content)) {
        return { key, source: fileName }
      }
    }
  }

  return null
}

export function ensureClaudeEntrypointLink(targetRoot, summary) {
  const claudePath = resolve(targetRoot, '.CLAUDE.md')

  if (!existsSync(claudePath)) {
    symlinkSync('AGENTS.md', claudePath)
    summary.created.push('.CLAUDE.md -> AGENTS.md')
    return
  }

  try {
    const stats = lstatSync(claudePath)
    if (stats.isSymbolicLink() && readlinkSync(claudePath) === 'AGENTS.md') {
      summary.skipped.push('.CLAUDE.md')
      return
    }
  } catch {
    // fall through to warning
  }

  summary.warnings.push('检测到现有 .CLAUDE.md，未覆盖；如需与 AGENTS.md 同步，请手动改成指向 AGENTS.md 的链接')
}

export function detectPackageManager(root) {
  if (existsSync(resolve(root, 'pnpm-lock.yaml'))) {
    return { name: 'pnpm', installCommand: 'pnpm install' }
  }
  if (existsSync(resolve(root, 'yarn.lock'))) {
    return { name: 'yarn', installCommand: 'yarn install' }
  }
  if (existsSync(resolve(root, 'package-lock.json'))) {
    return { name: 'npm', installCommand: 'npm install' }
  }
  return { name: 'npm', installCommand: 'npm install' }
}

export function createInstallEnv(packageManager) {
  const installEnv = { ...env }

  if (packageManager.name === 'npm' && !installEnv.NPM_CONFIG_CACHE) {
    const cacheRoot = resolve(tmpdir(), 'harness-workflow-framework', 'npm-cache')
    mkdirSync(cacheRoot, { recursive: true })
    installEnv.NPM_CONFIG_CACHE = cacheRoot
  }

  return installEnv
}

export function assertInstallTargetSafe(targetRoot, sourceRoot) {
  const normalizedTarget = resolve(targetRoot)
  const normalizedSource = resolve(sourceRoot)

  if (normalizedTarget === normalizedSource) {
    throw new Error('当前目录是框架模板自身，请显式传入目标项目目录')
  }

  if (isPathEqualOrInside(normalizedSource, normalizedTarget)) {
    throw new Error(`目标目录位于框架模板目录内，不能安装到模板源码树中: ${normalizedTarget}`)
  }
}

export function assertCopyTargetSafe(sourcePath, targetPath) {
  const normalizedSource = resolve(sourcePath)
  const normalizedTarget = resolve(targetPath)

  if (isPathEqualOrInside(normalizedSource, normalizedTarget)) {
    throw new Error(`复制目标不能位于源目录内部: ${normalizedTarget}`)
  }
}

export function isPathEqualOrInside(parentPath, candidatePath) {
  const relativePath = relative(resolve(parentPath), resolve(candidatePath))

  return (
    relativePath === '' ||
    (relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath))
  )
}
