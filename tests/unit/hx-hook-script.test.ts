import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'hxflow', 'scripts', 'lib', 'hook.ts')
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-hook-script-'))
  tempDirs.push(projectRoot)
  mkdirSync(join(projectRoot, '.hx'), { recursive: true })
  return projectRoot
}

describe('hx-hook script', () => {
  it('resolves configured pre-hook for hx-doc', () => {
    const projectRoot = createProject()
    writeFileSync(
      join(projectRoot, '.hx', 'config.yaml'),
      `runtime:
  hooks:
    hx-doc:
      pre:
        - .hx/hooks/pre_doc.md
`,
      'utf8',
    )
    const result = spawnSync('bun', [SCRIPT_PATH, 'resolve', 'hx-doc'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.command).toBe('hx-doc')
    expect(parsed.preHooks).toEqual([
      { scope: 'project', phase: 'pre', path: '.hx/hooks/pre_doc.md' },
    ])
    expect(parsed.postHooks).toEqual([])
  })

  it('returns empty hook lists for commands without hook files', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'resolve', 'plan'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.command).toBe('hx-plan')
    expect(parsed.preHooks).toEqual([])
    expect(parsed.postHooks).toEqual([])
  })
})
