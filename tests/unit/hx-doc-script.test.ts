import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_PATH = resolve(process.cwd(), 'hxflow', 'scripts', 'tools', 'doc.ts')
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hx-doc-script-'))
  tempDirs.push(projectRoot)
  mkdirSync(join(projectRoot, '.hx', 'rules'), { recursive: true })
  mkdirSync(join(projectRoot, 'docs', 'requirement'), { recursive: true })
  writeFileSync(
    join(projectRoot, '.hx', 'config.yaml'),
    `rules:
  templates:
    requirement: .hx/rules/requirement-template.md
    bugfixRequirement: .hx/rules/bugfix-requirement-template.md
    plan: .hx/rules/plan-template.md
    bugfixPlan: .hx/rules/bugfix-plan-template.md
`,
    'utf8',
  )
  writeFileSync(
    join(projectRoot, '.hx', 'rules', 'requirement-template.md'),
    `# Custom Requirement Template

> Feature: SHOULD-NOT-BE-USED
> Display Name: SHOULD-NOT-BE-USED
> Source ID: SHOULD-NOT-BE-USED
> Source Fingerprint: SHOULD-NOT-BE-USED
> Type: feature

## 背景

- 自定义正文
`,
    'utf8',
  )
  writeFileSync(join(projectRoot, '.hx', 'rules', 'bugfix-requirement-template.md'), '# Custom Bugfix Requirement Template\n', 'utf8')
  return projectRoot
}

describe('hx-doc script', () => {
  it('reads requirement template from rules.templates config', () => {
    const projectRoot = createProject()
    const result = spawnSync('bun', [SCRIPT_PATH, 'context', 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.ok).toBe(true)
    expect(summary.headerTemplate).toContain('> Feature: AUTH-001')
    expect(summary.headerTemplate).toContain('> Type: feature')
    expect(summary.templateContent).toContain('# Custom Requirement Template')
    expect(summary.templateContent).toContain('## 背景')
    expect(summary.templateContent).not.toContain('SHOULD-NOT-BE-USED')
  })

  it('fails when rules.templates.requirement is missing', () => {
    const projectRoot = createProject()
    writeFileSync(
      join(projectRoot, '.hx', 'config.yaml'),
      `rules:
  templates:
    bugfixRequirement: .hx/rules/bugfix-requirement-template.md
    plan: .hx/rules/plan-template.md
    bugfixPlan: .hx/rules/bugfix-plan-template.md
`,
      'utf8',
    )

    const result = spawnSync('bun', [SCRIPT_PATH, 'context', 'AUTH-001'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('rules.templates.requirement')
  })
})
