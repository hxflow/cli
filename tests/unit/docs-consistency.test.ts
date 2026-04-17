import { readFileSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'bun:test'

const ROOT = process.cwd()

describe('docs consistency', () => {
  it('removes stale path and config references from updated docs', () => {
    const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8')
    const agents = readFileSync(resolve(ROOT, 'AGENTS.md'), 'utf8')

    expect(readme).not.toContain('src/agents/')
    expect(readme).not.toContain('~/.hx/config.yaml')
    expect(agents).not.toContain('src/agents/')
  })

  it('documents current skill architecture without runtime contract', () => {
    const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8')
    const skill = readFileSync(resolve(ROOT, 'hxflow', 'SKILL.md'), 'utf8')

    expect(readme).not.toContain('.hx/commands/')
    expect(readme).not.toContain('.hx/skills/')
    expect(readme).not.toContain('hx setup')
    expect(readme).toContain('hxflow/SKILL.md')
    expect(readme).not.toContain('feature-contract.md')
    expect(readme).toContain('.hx/config.yaml')
    expect(readme).not.toContain('contracts/runtime-contract.md')
    expect(skill).toContain('bun scripts/lib/hook.ts resolve <command>')
    expect(skill).toContain('npx tsx scripts/lib/hook.ts resolve <command>')
  })

  it('removes task-id driven wording from the main workflow docs', () => {
    const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8')
    const skill = readFileSync(resolve(ROOT, 'hxflow', 'SKILL.md'), 'utf8')

    expect(readme).not.toContain('--task <id>')
    expect(readme).not.toContain('feature key')
    expect(skill).toContain('preHooks')
  })
})
