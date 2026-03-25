import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const BIN_PATH = resolve(ROOT, 'bin/hx.js')
const PACKAGE_VERSION = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version

describe('hx cli entry', () => {
  it('prints help output', () => {
    const result = runHx(['--help'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Harness Workflow CLI')
    expect(result.stdout).toContain('用法: hx <command> [options]')
  })

  it('prints the current package version', () => {
    const result = runHx(['version'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(`hx v${PACKAGE_VERSION}`)
  })

  it('dispatches mapped commands to their scripts', () => {
    const result = runHx(['review', '--profile', 'backend'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('PR Review 清单')
    expect(result.stdout).toContain('服务端')
  })

  it('rejects unknown commands', () => {
    const result = runHx(['unknown-command'])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('未知命令: unknown-command')
  })
})

function runHx(args) {
  return spawnSync(process.execPath, [BIN_PATH, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0'
    }
  })
}
