import { execFileSync, spawnSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
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

describe('hx cli integration', () => {
  it('prints help and version', () => {
    expect(runNode(['bin/hx.js', '--help'])).toContain('Harness Workflow CLI')
    expect(runNode(['bin/hx.js', '--help'])).toContain('migrate')
    expect(runNode(['bin/hx.js', 'version'])).toMatch(/hx v\d+\.\d+\.\d+/)
  })

  it('runs migrate against legacy settings and ignores deprecated agents', () => {
    const userHxDir = createTempDir('hx-migrate-user-')
    const userClaudeDir = createTempDir('hx-migrate-claude-')

    writeFileSync(
      resolve(userHxDir, 'settings.yaml'),
      'frameworkRoot: /legacy/framework\nagents: claude,qwen\n',
      'utf8'
    )

    const result = spawnSync(
      process.execPath,
      [
        'bin/hx.js',
        'migrate',
        '--dry-run',
        '--user-hx-dir',
        userHxDir,
        '--user-claude-dir',
        userClaudeDir,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      }
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Harness Workflow · migrate')
    expect(result.stdout).toContain('source      → settings')
    expect(result.stdout).toContain('agents      → claude')
    expect(result.stdout).toContain('deprecated  → qwen')
  })

  it('reports contract commands without executing local scripts', () => {
    const result = spawnSync(process.execPath, ['bin/hx.js', 'hx-init'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('"hx-init" 是 agent 命令 contract')
  })

  it('reports unknown commands', () => {
    const result = spawnSync(process.execPath, ['bin/hx.js', 'unknown-command'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('未知命令: unknown-command')
    expect(result.stderr).toContain('当前 CLI 仅直接执行: setup, migrate, version')
  })
})
