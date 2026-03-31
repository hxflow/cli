import { execFileSync, spawnSync } from 'child_process'

import { describe, expect, it } from 'vitest'

function runNode(args) {
  return execFileSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
}

describe('hx cli integration', () => {
  it('prints help and version', () => {
    expect(runNode(['bin/hx.js', '--help'])).toContain('Harness Workflow CLI')
    expect(runNode(['bin/hx.js', 'version'])).toMatch(/hx v\d+\.\d+\.\d+/)
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
    expect(result.stderr).toContain('当前 CLI 仅直接执行: setup, version')
  })
})
