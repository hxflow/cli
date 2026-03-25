import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, lstatSync, mkdtempSync, readFileSync, readlinkSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('workflow cli integration', () => {
  it('installs framework assets including .claude and .CLAUDE.md entrypoint', () => {
    const targetRoot = makeTempDir('hx-install-integration-')
    const result = runCli(ROOT, 'src/scripts/hx-install.cjs', [targetRoot, '--yes', '--profile', 'mobile:ios', '--skip-install'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Harness Workflow Framework 安装完成')
    expect(readlinkSync(resolve(targetRoot, '.CLAUDE.md'))).toBe('AGENTS.md')
    expect(existsSync(resolve(targetRoot, '.claude/commands/hx-run.md'))).toBe(true)
    expect(existsSync(resolve(targetRoot, '.claude/skills/gitlab/SKILL.md'))).toBe(true)

    const config = JSON.parse(readFileSync(resolve(targetRoot, '.hx/config.json'), 'utf8'))
    expect(config.defaultProfile).toBe('mobile:ios')
  })

  it('runs doc, plan, review and ctx scripts against an installed project', () => {
    const targetRoot = makeTempDir('hx-workflow-integration-')
    const install = runCli(ROOT, 'src/scripts/hx-install.cjs', [targetRoot, '--yes', '--profile', 'backend', '--skip-install'])
    expect(install.status).toBe(0)

    const doc = runCli(targetRoot, 'src/scripts/hx-new-doc.js', ['order-search'])
    expect(doc.status).toBe(0)
    expect(doc.stdout).toContain('order-search.md')

    const plan = runCli(targetRoot, 'src/scripts/hx-new-plan.js', ['order-search'])
    expect(plan.status).toBe(0)
    expect(plan.stdout).toContain('order-search.md')

    const progressPath = findProgressPath(targetRoot, 'order-search')
    const progress = JSON.parse(readFileSync(progressPath, 'utf8'))
    expect(progress.profile).toBe('backend')
    expect(progress.requirementDoc).toMatch(/order-search\.md$/)
    expect(progress.tasks.length).toBeGreaterThan(0)

    const review = runCli(targetRoot, 'src/scripts/hx-review-checklist.js', [])
    expect(review.status).toBe(0)
    expect(review.stdout).toContain('服务端')

    const ctx = runCli(targetRoot, 'src/scripts/hx-ctx-check.js', [])
    expect(ctx.status).toBe(0)
    expect(ctx.stdout).toContain('全部通过')

    expect(lstatSync(resolve(targetRoot, '.CLAUDE.md')).isSymbolicLink()).toBe(true)
  })

  it('runs agent prompt, fix prompt and task completion commands against an installed project', () => {
    const targetRoot = makeTempDir('hx-agent-workflow-integration-')
    expect(runCli(ROOT, 'src/scripts/hx-install.cjs', [targetRoot, '--yes', '--profile', 'backend', '--skip-install']).status).toBe(0)
    expect(runCli(targetRoot, 'src/scripts/hx-new-doc.js', ['order-search']).status).toBe(0)
    expect(runCli(targetRoot, 'src/scripts/hx-new-plan.js', ['order-search']).status).toBe(0)

    const initialProgress = JSON.parse(readFileSync(findProgressPath(targetRoot, 'order-search'), 'utf8'))
    const [firstTask, secondTask] = initialProgress.tasks

    const run = runCli(targetRoot, 'src/scripts/hx-agent-run.js', ['order-search', firstTask.id])
    expect(run.status).toBe(0)
    expect(run.stdout).toContain(`任务 ID：${firstTask.id}`)
    expect(run.stdout).toContain('AGENTS.md')
    expect(run.stdout).toContain('docs/plans/order-search.md')
    expect(run.stdout).toContain('docs/requirement/order-search.md')

    const fix = runCli(targetRoot, 'src/scripts/hx-agent-fix.js', ['--profile', 'backend', '--log=TypeError: order-search failed'])
    expect(fix.status).toBe(0)
    expect(fix.stdout).toContain('TypeError: order-search failed')
    expect(fix.stdout).toContain('AGENTS.md')

    const done = runCli(targetRoot, 'src/scripts/hx-task-done.js', [firstTask.id])
    expect(done.status).toBe(0)
    expect(done.stdout).toContain(`${firstTask.id} 已标记为完成`)

    const updatedProgress = JSON.parse(readFileSync(findProgressPath(targetRoot, 'order-search'), 'utf8'))
    expect(updatedProgress.tasks[0].status).toBe('done')
    expect(updatedProgress.tasks[0].completedAt).toBeTruthy()
    if (secondTask) {
      expect(done.stdout).toContain(secondTask.id)
    }
  })
})

function runCli(cwd, scriptPath, args) {
  const abs = resolve(ROOT, scriptPath)
  return spawnSync(process.execPath, [abs, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0'
    }
  })
}

function makeTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function findProgressPath(targetRoot, featureName) {
  const progressPath = resolve(targetRoot, 'docs/plans', `${featureName}-progress.json`)

  expect(existsSync(progressPath)).toBe(true)

  return progressPath
}
