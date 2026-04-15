import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'bun:test'

const ROOT = process.cwd()
const PACKAGE_JSON_PATH = resolve(ROOT, 'package.json')

describe('package manifest', () => {
  it('publishes SKILL.md and core source directories', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'))

    expect(pkg.files).toContain('SKILL.md')
    expect(pkg.files).toContain('src/commands/**/*')
    expect(pkg.files).toContain('src/contracts/**/*')
    expect(pkg.files).toContain('src/tools/**/*')
    expect(pkg.files).toContain('src/lib/**/*')
  })

  it('does not expose CLI bin entry', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'))

    expect(pkg.bin).toBeUndefined()
    expect(existsSync(resolve(ROOT, 'bin/hx.js'))).toBe(false)
  })

  it('has root SKILL.md as skill entry point', () => {
    expect(existsSync(resolve(ROOT, 'SKILL.md'))).toBe(true)
    const content = readFileSync(resolve(ROOT, 'SKILL.md'), 'utf8')
    expect(content).toContain('name: hx')
    expect(content).toContain('src/contracts/runtime-contract.md')
  })
})
