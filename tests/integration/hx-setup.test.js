import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import { afterEach, describe, expect, it } from 'vitest'

const tempDirs = []

function createTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function runNode(args) {
  return execFileSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('hx setup integration', () => {
  it('creates user skeleton, settings, and agent adapters', () => {
    const userHxDir = createTempDir('hx-user-')
    const userClaudeDir = createTempDir('hx-claude-')
    const userCodexDir = createTempDir('hx-codex-')

    const output = runNode([
      'src/scripts/hx-setup.js',
      '--user-hx-dir',
      userHxDir,
      '--user-claude-dir',
      userClaudeDir,
      '--user-codex-dir',
      userCodexDir,
    ])

    expect(output).toContain('Harness Workflow · setup')
    expect(existsSync(resolve(userHxDir, 'commands'))).toBe(true)
    expect(existsSync(resolve(userHxDir, 'hooks'))).toBe(true)
    expect(existsSync(resolve(userHxDir, 'pipelines'))).toBe(true)
    expect(readFileSync(resolve(userHxDir, 'settings.yaml'), 'utf8')).toContain(`frameworkRoot: ${process.cwd()}`)
    expect(readFileSync(resolve(userClaudeDir, 'commands', 'hx-doc.md'), 'utf8')).toContain('hx-forwarder: hx-doc')
    expect(readFileSync(resolve(userCodexDir, 'skills', 'hx-doc', 'SKILL.md'), 'utf8')).toContain('hx-skill: hx-doc')
  })

  it('prunes stale adapters for commands removed from the framework', () => {
    const userHxDir = createTempDir('hx-user-stale-')
    const userClaudeDir = createTempDir('hx-claude-stale-')
    const userCodexDir = createTempDir('hx-codex-stale-')
    const staleForwarder = resolve(userClaudeDir, 'commands', 'hx-setup.md')
    const staleSkillDir = resolve(userCodexDir, 'skills', 'hx-setup')
    const staleSkill = resolve(staleSkillDir, 'SKILL.md')

    mkdirSync(resolve(userClaudeDir, 'commands'), { recursive: true })
    mkdirSync(staleSkillDir, { recursive: true })
    writeFileSync(staleForwarder, '<!-- hx-forwarder: hx-setup — stale -->\n', 'utf8')
    writeFileSync(staleSkill, '<!-- hx-skill: hx-setup — stale -->\n', 'utf8')

    const output = runNode([
      'src/scripts/hx-setup.js',
      '--user-hx-dir',
      userHxDir,
      '--user-claude-dir',
      userClaudeDir,
      '--user-codex-dir',
      userCodexDir,
    ])

    expect(output).toContain('删除:')
    expect(output).toContain('~/.claude/commands/hx-setup.md')
    expect(output).toContain('~/.codex/skills/hx-setup/')
    expect(existsSync(staleForwarder)).toBe(false)
    expect(existsSync(staleSkill)).toBe(false)
  })

  it('supports dry-run without writing files', () => {
    const userHxDir = createTempDir('hx-user-dry-')
    const userClaudeDir = createTempDir('hx-claude-dry-')
    const userCodexDir = createTempDir('hx-codex-dry-')

    const output = runNode([
      'src/scripts/hx-setup.js',
      '--dry-run',
      '--user-hx-dir',
      userHxDir,
      '--user-claude-dir',
      userClaudeDir,
      '--user-codex-dir',
      userCodexDir,
    ])

    expect(output).toContain('[dry-run] 未实际写入。')
    expect(existsSync(resolve(userHxDir, 'settings.yaml'))).toBe(false)
    expect(existsSync(resolve(userClaudeDir, 'commands', 'hx-doc.md'))).toBe(false)
    expect(existsSync(resolve(userCodexDir, 'skills', 'hx-doc', 'SKILL.md'))).toBe(false)
  })
})
