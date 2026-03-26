import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import {
  HARNESS_MARKER_START,
  HARNESS_MARKER_END,
  buildHarnessBlock,
  escapeRegExp,
  generateForwarderFiles,
  syncSkillDirs
} from '../../src/scripts/lib/install-utils.js'

const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

function makeTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

// ── buildHarnessBlock ──────────────────────────────────────────────────────

describe('buildHarnessBlock', () => {
  it('包含开始和结束标记', () => {
    const block = buildHarnessBlock('backend')
    expect(block).toContain(HARNESS_MARKER_START)
    expect(block).toContain(HARNESS_MARKER_END)
  })

  it('包含传入的 profile 名称', () => {
    expect(buildHarnessBlock('backend')).toContain('backend')
    expect(buildHarnessBlock('mobile:ios')).toContain('mobile:ios')
    expect(buildHarnessBlock('frontend')).toContain('frontend')
  })

  it('以开始标记开头、以结束标记结尾', () => {
    const block = buildHarnessBlock('backend')
    expect(block.startsWith(HARNESS_MARKER_START)).toBe(true)
    expect(block.endsWith(HARNESS_MARKER_END)).toBe(true)
  })

  it('不同 profile 生成不同内容', () => {
    expect(buildHarnessBlock('backend')).not.toBe(buildHarnessBlock('frontend'))
  })
})

// ── escapeRegExp ───────────────────────────────────────────────────────────

describe('escapeRegExp', () => {
  it('转义正则特殊字符', () => {
    expect(escapeRegExp('.')).toBe('\\.')
    expect(escapeRegExp('*')).toBe('\\*')
    expect(escapeRegExp('+')).toBe('\\+')
    expect(escapeRegExp('?')).toBe('\\?')
    expect(escapeRegExp('^')).toBe('\\^')
    expect(escapeRegExp('$')).toBe('\\$')
    expect(escapeRegExp('[')).toBe('\\[')
    expect(escapeRegExp(']')).toBe('\\]')
    expect(escapeRegExp('(')).toBe('\\(')
    expect(escapeRegExp(')')).toBe('\\)')
    expect(escapeRegExp('{')).toBe('\\{')
    expect(escapeRegExp('}')).toBe('\\}')
    expect(escapeRegExp('|')).toBe('\\|')
    expect(escapeRegExp('\\')).toBe('\\\\')
  })

  it('普通字符串不被修改', () => {
    expect(escapeRegExp('hello_world')).toBe('hello_world')
    expect(escapeRegExp('hxflow123')).toBe('hxflow123')
  })

  it('marker 字符串可以安全用于 RegExp', () => {
    const escaped = escapeRegExp(HARNESS_MARKER_START)
    expect(() => new RegExp(escaped)).not.toThrow()
  })
})

// ── generateForwarderFiles ─────────────────────────────────────────────────

describe('generateForwarderFiles', () => {
  it('为 sourceDir 中每个 hx-*.md 创建转发器文件', () => {
    const sourceDir = makeTempDir('gen-src-')
    const targetDir = makeTempDir('gen-dst-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), '# hx-run entity', 'utf8')
    writeFileSync(resolve(sourceDir, 'hx-plan.md'), '# hx-plan entity', 'utf8')
    writeFileSync(resolve(sourceDir, 'not-hx.md'), '# should be ignored', 'utf8')
    writeFileSync(resolve(sourceDir, 'hx-run.txt'), '# wrong extension', 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/fw', '/user-hx', summary, {})

    expect(existsSync(resolve(targetDir, 'hx-run.md'))).toBe(true)
    expect(existsSync(resolve(targetDir, 'hx-plan.md'))).toBe(true)
    expect(existsSync(resolve(targetDir, 'not-hx.md'))).toBe(false)
    expect(existsSync(resolve(targetDir, 'hx-run.txt'))).toBe(false)
    expect(summary.created).toContain('~/.claude/commands/hx-run.md')
    expect(summary.created).toContain('~/.claude/commands/hx-plan.md')
  })

  it('转发器内容包含三层查找路径', () => {
    const sourceDir = makeTempDir('gen-content-src-')
    const targetDir = makeTempDir('gen-content-dst-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), '# hx-run', 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/framework', '/user-hx', summary, {})

    const content = readFileSync(resolve(targetDir, 'hx-run.md'), 'utf8')
    expect(content).toContain('.hx/commands/hx-run.md')       // 项目层
    expect(content).toContain('/user-hx/commands/hx-run.md') // 用户层
    expect(content).toContain('/framework')                    // 系统层
  })

  it('文件无变化时放入 skipped，不放 created', () => {
    const sourceDir = makeTempDir('gen-skip-src-')
    const targetDir = makeTempDir('gen-skip-dst-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), '# hx-run', 'utf8')

    const summary1 = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/fw', '/user-hx', summary1, {})

    const summary2 = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/fw', '/user-hx', summary2, {})

    expect(summary2.skipped.length).toBe(1)
    expect(summary2.created.length).toBe(0)
  })

  it('sourceDir 不存在时写入 warnings', () => {
    const targetDir = makeTempDir('gen-nosrc-dst-')
    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles('/nonexistent/commands', targetDir, '/fw', '/user-hx', summary, {})

    expect(summary.warnings.length).toBeGreaterThan(0)
    expect(summary.created.length).toBe(0)
  })

  it('targetDir 不存在且 createDir=false 时写入 warnings', () => {
    const sourceDir = makeTempDir('gen-nodst-src-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), '# hx-run', 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, '/nonexistent/target', '/fw', '/user-hx', summary, {})

    expect(summary.warnings.length).toBeGreaterThan(0)
  })

  it('createDir=true 时自动创建 targetDir', () => {
    const sourceDir = makeTempDir('gen-mkdir-src-')
    const parent = makeTempDir('gen-mkdir-parent-')
    const targetDir = resolve(parent, 'commands')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), '# hx-run', 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/fw', '/user-hx', summary, { createDir: true })

    expect(existsSync(targetDir)).toBe(true)
    expect(existsSync(resolve(targetDir, 'hx-run.md'))).toBe(true)
  })

  it('dryRun=true 时不写入文件，但记录 created', () => {
    const sourceDir = makeTempDir('gen-dry-src-')
    const targetDir = makeTempDir('gen-dry-dst-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), '# hx-run', 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/fw', '/user-hx', summary, { dryRun: true })

    expect(existsSync(resolve(targetDir, 'hx-run.md'))).toBe(false)
    expect(summary.created).toContain('~/.claude/commands/hx-run.md')
  })

  it('路径变更时将文件放入 updated 而非 created', () => {
    const sourceDir = makeTempDir('gen-update-src-')
    const targetDir = makeTempDir('gen-update-dst-')
    writeFileSync(resolve(sourceDir, 'hx-run.md'), '# hx-run', 'utf8')

    const summary1 = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/fw-old', '/user-hx', summary1, {})

    const summary2 = { created: [], updated: [], skipped: [], warnings: [] }
    generateForwarderFiles(sourceDir, targetDir, '/fw-new', '/user-hx', summary2, {})

    expect(summary2.updated).toContain('~/.claude/commands/hx-run.md')
    expect(summary2.created.length).toBe(0)
  })
})

// ── syncSkillDirs ──────────────────────────────────────────────────────────

describe('syncSkillDirs', () => {
  it('将 skill 子目录从 source 复制到 target', () => {
    const sourceDir = makeTempDir('sync-src-')
    const targetDir = makeTempDir('sync-dst-')
    mkdirSync(resolve(sourceDir, 'gitlab'), { recursive: true })
    writeFileSync(resolve(sourceDir, 'gitlab', 'SKILL.md'), '# gitlab skill', 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    syncSkillDirs(sourceDir, targetDir, summary, {})

    expect(existsSync(resolve(targetDir, 'gitlab', 'SKILL.md'))).toBe(true)
    expect(summary.created).toContain('.claude/skills/gitlab/')
  })

  it('默认情况下跳过已存在的 skill 目录', () => {
    const sourceDir = makeTempDir('sync-skip-src-')
    const targetDir = makeTempDir('sync-skip-dst-')
    mkdirSync(resolve(sourceDir, 'gitlab'), { recursive: true })
    writeFileSync(resolve(sourceDir, 'gitlab', 'SKILL.md'), '# new', 'utf8')
    mkdirSync(resolve(targetDir, 'gitlab'), { recursive: true })
    writeFileSync(resolve(targetDir, 'gitlab', 'SKILL.md'), '# existing', 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    syncSkillDirs(sourceDir, targetDir, summary, {})

    expect(summary.skipped).toContain('.claude/skills/gitlab/ (已存在)')
    expect(readFileSync(resolve(targetDir, 'gitlab', 'SKILL.md'), 'utf8')).toBe('# existing')
  })

  it('sourceDir 不存在时静默返回', () => {
    const targetDir = makeTempDir('sync-nosrc-dst-')
    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    syncSkillDirs('/nonexistent/skills', targetDir, summary, {})

    expect(summary.created.length).toBe(0)
    expect(summary.warnings.length).toBe(0)
  })

  it('dryRun=true 时不实际创建目录', () => {
    const sourceDir = makeTempDir('sync-dry-src-')
    const targetDir = makeTempDir('sync-dry-dst-')
    mkdirSync(resolve(sourceDir, 'gitlab'), { recursive: true })
    writeFileSync(resolve(sourceDir, 'gitlab', 'SKILL.md'), '# skill', 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    syncSkillDirs(sourceDir, targetDir, summary, { dryRun: true })

    expect(existsSync(resolve(targetDir, 'gitlab'))).toBe(false)
    expect(summary.created).toContain('.claude/skills/gitlab/')
  })

  it('sourceDir 为空目录时不报错', () => {
    const sourceDir = makeTempDir('sync-empty-src-')
    const targetDir = makeTempDir('sync-empty-dst-')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    expect(() => syncSkillDirs(sourceDir, targetDir, summary, {})).not.toThrow()
    expect(summary.created.length).toBe(0)
  })

  it('createDir=true 时自动创建 targetDir', () => {
    const sourceDir = makeTempDir('sync-mkdir-src-')
    const parent = makeTempDir('sync-mkdir-parent-')
    const targetDir = resolve(parent, 'skills')
    mkdirSync(resolve(sourceDir, 'gitlab'), { recursive: true })
    writeFileSync(resolve(sourceDir, 'gitlab', 'SKILL.md'), '# skill', 'utf8')

    const summary = { created: [], updated: [], skipped: [], warnings: [] }
    syncSkillDirs(sourceDir, targetDir, summary, { createDir: true })

    expect(existsSync(targetDir)).toBe(true)
    expect(existsSync(resolve(targetDir, 'gitlab', 'SKILL.md'))).toBe(true)
  })
})
