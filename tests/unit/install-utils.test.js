import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  generateCodexSkillFiles,
  generateForwarderFiles,
  loadCommandSpecs,
  mergeCommandSpecs,
  resolveAgentTargets,
} from '../../src/scripts/lib/install-utils.js'

const tempDirs = []

function createTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function createSummary() {
  return { created: [], updated: [], removed: [], skipped: [], warnings: [] }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('install-utils', () => {
  it('resolves agent targets and rejects invalid values', () => {
    expect(resolveAgentTargets()).toEqual(['claude', 'codex'])
    expect(resolveAgentTargets('claude')).toEqual(['claude'])
    expect(resolveAgentTargets('codex,claude,codex')).toEqual(['codex', 'claude'])
    expect(() => resolveAgentTargets('claude,unknown')).toThrow('无效的 agent')
  })

  it('loads command specs from frontmatter and merges with protected precedence', () => {
    const frameworkDir = createTempDir('hx-framework-commands-')
    const userDir = createTempDir('hx-user-commands-')
    const projectDir = createTempDir('hx-project-commands-')

    writeFileSync(resolve(frameworkDir, 'hx-init.md'), [
      '---',
      'name: hx-init',
      'description: Framework Init',
      'protected: true',
      '---',
      '',
      '# init',
      '',
    ].join('\n'))
    writeFileSync(resolve(frameworkDir, 'hx-doc.md'), [
      '---',
      'description: Framework Doc',
      '---',
      '',
      '# doc',
      '',
    ].join('\n'))
    writeFileSync(resolve(userDir, 'hx-doc.md'), [
      '---',
      'description: User Doc',
      '---',
      '',
      '# doc',
      '',
    ].join('\n'))
    writeFileSync(resolve(projectDir, 'hx-doc.md'), [
      '---',
      'description: Project Doc',
      '---',
      '',
      '# doc',
      '',
    ].join('\n'))
    writeFileSync(resolve(projectDir, 'notes.md'), '# ignore\n')

    const merged = mergeCommandSpecs(
      loadCommandSpecs(frameworkDir),
      loadCommandSpecs(userDir),
      loadCommandSpecs(projectDir)
    )

    expect(merged).toEqual([
      { name: 'hx-doc', description: 'Project Doc', protected: false },
      { name: 'hx-init', description: 'Framework Init', protected: true },
    ])
  })

  it('generates forwarder and codex files from templates', () => {
    const targetDir = createTempDir('hx-adapter-target-')
    const codexDir = createTempDir('hx-codex-target-')
    const frameworkRoot = resolve(process.cwd(), 'src')
    const userHxDir = '/tmp/hx-user'
    const summary = createSummary()
    const codexSummary = createSummary()
    const specs = [
      { name: 'hx-doc', description: 'Doc Command', protected: false },
      { name: 'hx-init', description: 'Init Command', protected: true },
    ]

    generateForwarderFiles(specs, targetDir, frameworkRoot, userHxDir, summary, { createDir: true })
    generateCodexSkillFiles(specs, codexDir, frameworkRoot, userHxDir, codexSummary, { createDir: true })

    const forwarder = readFileSync(resolve(targetDir, 'hx-doc.md'), 'utf8')
    const protectedForwarder = readFileSync(resolve(targetDir, 'hx-init.md'), 'utf8')
    const codexSkill = readFileSync(resolve(codexDir, 'hx-doc', 'SKILL.md'), 'utf8')
    const protectedCodexSkill = readFileSync(resolve(codexDir, 'hx-init', 'SKILL.md'), 'utf8')

    expect(forwarder).toContain('hx-forwarder: hx-doc')
    expect(forwarder).toContain('按以下优先级找到第一个存在的文件')
    expect(forwarder).toContain('`.hx/config.yaml` 或 `.git`')
    expect(forwarder).toContain('`/tmp/hx-user/commands/hx-doc.md`')
    expect(forwarder).toContain(`\`${frameworkRoot}/commands/hx-doc.md\``)
    expect(forwarder).toContain('`/tmp/hx-user/commands/hx-doc.md`')
    expect(forwarder).toContain('`<项目根>/.hx/commands/hx-doc.md`')
    expect(forwarder).not.toContain('protected: 此命令由框架锁定')
    expect(protectedForwarder).toContain('protected: 此命令由框架锁定')
    expect(protectedForwarder).toContain(`\`${frameworkRoot}/commands/hx-init.md\``)
    expect(protectedForwarder).not.toContain('/tmp/hx-user/commands/hx-init.md')
    expect(protectedForwarder).not.toContain('<项目根>/.hx/commands/hx-init.md')
    expect(codexSkill).toContain('hx-skill: hx-doc')
    expect(codexSkill).toContain('name: hx-doc')
    expect(codexSkill).toContain('按以下优先级找到第一个存在的文件')
    expect(codexSkill).toContain(`\`${frameworkRoot}/commands/hx-doc.md\``)
    expect(protectedCodexSkill).toContain('hx-skill: hx-init')
    expect(protectedCodexSkill).toContain('protected: 此命令由框架锁定')
    expect(protectedCodexSkill).toContain(`\`${frameworkRoot}/commands/hx-init.md\``)
    expect(protectedCodexSkill).not.toContain('/tmp/hx-user/commands/hx-init.md')
    expect(codexSummary.created).toContain('~/.codex/skills/hx-doc/SKILL.md')
  })

  it('skips writing unchanged adapter files', () => {
    const targetDir = createTempDir('hx-forwarder-repeat-')
    const frameworkRoot = resolve(process.cwd(), 'src')
    const userHxDir = '/tmp/hx-user'
    const spec = [{ name: 'hx-doc', description: 'Doc Command', protected: false }]

    generateForwarderFiles(spec, targetDir, frameworkRoot, userHxDir, createSummary(), { createDir: true })
    const secondSummary = createSummary()
    generateForwarderFiles(spec, targetDir, frameworkRoot, userHxDir, secondSummary, { createDir: true })

    expect(secondSummary.skipped).toContain('~/.claude/commands/hx-doc.md (无变化)')
  })

  it('prunes stale managed adapter files for removed commands', () => {
    const targetDir = createTempDir('hx-forwarder-stale-')
    const codexDir = createTempDir('hx-codex-stale-')
    const frameworkRoot = resolve(process.cwd(), 'src')
    const userHxDir = '/tmp/hx-user'
    const specs = [{ name: 'hx-doc', description: 'Doc Command', protected: false }]
    const forwarderSummary = createSummary()
    const codexSummary = createSummary()

    writeFileSync(
      resolve(targetDir, 'hx-setup.md'),
      '<!-- hx-forwarder: hx-setup — 由 hx setup 自动生成，请勿手动修改 -->\n',
      'utf8'
    )
    mkdirSync(resolve(codexDir, 'hx-setup'), { recursive: true })
    writeFileSync(
      resolve(codexDir, 'hx-setup', 'SKILL.md'),
      '<!-- hx-skill: hx-setup — 由 hx setup 自动生成，请勿手动修改 -->\n',
      'utf8'
    )

    generateForwarderFiles(specs, targetDir, frameworkRoot, userHxDir, forwarderSummary, { createDir: true })
    generateCodexSkillFiles(specs, codexDir, frameworkRoot, userHxDir, codexSummary, { createDir: true })

    expect(forwarderSummary.removed).toContain('~/.claude/commands/hx-setup.md')
    expect(codexSummary.removed).toContain('~/.codex/skills/hx-setup/')
    expect(() => readFileSync(resolve(targetDir, 'hx-setup.md'), 'utf8')).toThrow()
    expect(() => readFileSync(resolve(codexDir, 'hx-setup', 'SKILL.md'), 'utf8')).toThrow()
  })
})
