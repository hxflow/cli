import { spawnSync } from 'child_process'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import { afterEach, describe, expect, it } from 'vitest'

const tempDirs = []

function createTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function runPostinstall(env) {
  return spawnSync(process.execPath, ['src/scripts/hx-postinstall.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  })
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('hx postinstall integration', () => {
  it('skips auto setup when disabled explicitly', () => {
    const home = createTempDir('hx-home-disabled-')
    const result = runPostinstall({
      HOME: home,
      HX_DISABLE_AUTO_SETUP: '1',
    })

    expect(result.status).toBe(0)
    expect(existsSync(resolve(home, '.hx', 'settings.yaml'))).toBe(false)
  })

  it('skips auto setup when running inside the framework repo', () => {
    const home = createTempDir('hx-home-repo-')
    const result = runPostinstall({
      HOME: home,
      INIT_CWD: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(existsSync(resolve(home, '.hx', 'settings.yaml'))).toBe(false)
  })

  it('runs setup for normal installs', () => {
    const home = createTempDir('hx-home-normal-')
    const installCwd = createTempDir('hx-install-cwd-')
    const result = runPostinstall({
      HOME: home,
      INIT_CWD: installCwd,
    })

    expect(result.status).toBe(0)
    expect(existsSync(resolve(home, '.hx', 'settings.yaml'))).toBe(true)
    expect(existsSync(resolve(home, '.claude', 'commands', 'hx-doc.md'))).toBe(true)
    expect(existsSync(resolve(home, '.codex', 'skills', 'hx-doc', 'SKILL.md'))).toBe(true)
  })
})
