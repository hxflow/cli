import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'hxflow', 'scripts', 'tools', 'init.ts')
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-init-script-'))
  tempDirs.push(projectRoot)
  return projectRoot
}

describe('hx-init script', () => {
  it('materializes all rule templates into .hx/rules for user customization', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)

    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.status).toBe('initialized')
    expect(summary.written.some((file: string) => file.endsWith('.hx/config.yaml'))).toBe(true)
    expect(summary.written.some((file: string) => file.endsWith('.hx/rules/requirement-template.md'))).toBe(true)
    expect(summary.written.some((file: string) => file.endsWith('.hx/rules/plan-template.md'))).toBe(true)
    expect(summary.written.some((file: string) => file.endsWith('.hx/rules/bugfix-requirement-template.md'))).toBe(true)
    expect(summary.written.some((file: string) => file.endsWith('.hx/rules/bugfix-plan-template.md'))).toBe(true)
    expect(summary.missing).toEqual([])
    expect(summary.nextAction).toBe('hx doc <feature>')

    const rulesDir = join(projectRoot, '.hx', 'rules')
    expect(readFileSync(join(projectRoot, '.hx', 'config.yaml'), 'utf8')).toContain('src: src')
    expect(existsSync(join(rulesDir, 'requirement-template.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'plan-template.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'bugfix-requirement-template.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'bugfix-plan-template.md'))).toBe(true)
    expect(existsSync(join(projectRoot, '.hx', 'hooks'))).toBe(false)
    expect(existsSync(join(projectRoot, '.hx', 'pipelines'))).toBe(false)
  })

  it('keeps existing customized template content untouched', () => {
    const projectRoot = createProject()
    const rulesDir = join(projectRoot, '.hx', 'rules')
    mkdirSync(rulesDir, { recursive: true })
    writeFileSync(join(rulesDir, 'requirement-template.md'), '# Custom Requirement Template\n', 'utf8')

    const result = spawnSync('bun', [SCRIPT_PATH], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(readFileSync(join(rulesDir, 'requirement-template.md'), 'utf8')).toBe('# Custom Requirement Template\n')
  })
})
