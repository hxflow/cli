import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import {
  FRAMEWORK_ROOT,
  findProjectRoot,
  resolveContext
} from '../../src/scripts/lib/resolve-context.js'

const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('resolve-context', () => {
  it('finds the project root from .hx/config.json in nested directories', () => {
    const tempRoot = makeTempDir('resolve-context-root-')
    const nestedDir = resolve(tempRoot, 'packages/app/src')

    mkdirSync(nestedDir, { recursive: true })
    writeConfig(tempRoot, { defaultProfile: 'backend' })

    expect(findProjectRoot(nestedDir)).toBe(tempRoot)
  })

  it('uses docs-based default paths for installed projects', () => {
    const tempRoot = makeTempDir('resolve-context-defaults-')
    const nestedDir = resolve(tempRoot, 'apps/web')

    mkdirSync(nestedDir, { recursive: true })
    writeConfig(tempRoot, { defaultProfile: 'frontend' })

    const ctx = resolveContext(nestedDir)

    expect(ctx.projectRoot).toBe(tempRoot)
    expect(ctx.requirementDir).toBe(resolve(tempRoot, 'docs/requirement'))
    expect(ctx.plansDir).toBe(resolve(tempRoot, 'docs/plans'))
    expect(ctx.agentsPath).toBe(resolve(tempRoot, 'AGENTS.md'))
    expect(ctx.srcDir).toBe(resolve(tempRoot, 'src'))
    expect(ctx.defaultProfile).toBe('frontend')
    expect(ctx.goldenPrinciplesPath).toBe(resolve(FRAMEWORK_ROOT, 'docs/golden-principles.md'))
  })

  it('applies explicit path overrides from .hx/config.json', () => {
    const tempRoot = makeTempDir('resolve-context-json-paths-')
    writeConfig(tempRoot, {
      defaultProfile: 'mobile:android',
      paths: {
        requirement: 'workflow/requirement',
        plans: 'workflow/plans',
        src: 'packages/mobile/src',
        agents: '.config/AGENTS.md'
      }
    })

    const ctx = resolveContext(tempRoot)

    expect(ctx.requirementDir).toBe(resolve(tempRoot, 'workflow/requirement'))
    expect(ctx.plansDir).toBe(resolve(tempRoot, 'workflow/plans'))
    expect(ctx.srcDir).toBe(resolve(tempRoot, 'packages/mobile/src'))
    expect(ctx.agentsPath).toBe(resolve(tempRoot, '.config/AGENTS.md'))
    expect(ctx.defaultProfile).toBe('mobile:android')
  })

  it('ignores harness.config.json when resolving project roots', () => {
    const tempRoot = makeTempDir('resolve-context-legacy-')
    const nestedDir = resolve(tempRoot, 'packages/app/src')

    mkdirSync(nestedDir, { recursive: true })
    writeFileSync(resolve(tempRoot, 'harness.config.json'), JSON.stringify({ defaultProfile: 'backend' }), 'utf8')

    expect(findProjectRoot(nestedDir)).toBe(nestedDir)
  })

  it('falls back to the nearest git repository when no config file exists', () => {
    const tempRoot = makeTempDir('resolve-context-git-')
    const nestedDir = resolve(tempRoot, 'nested/path')

    mkdirSync(resolve(tempRoot, '.git'), { recursive: true })
    mkdirSync(nestedDir, { recursive: true })

    expect(findProjectRoot(nestedDir)).toBe(tempRoot)
  })
})

function makeTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function writeConfig(root, config) {
  const hxDir = resolve(root, '.hx')
  mkdirSync(hxDir, { recursive: true })
  writeFileSync(resolve(hxDir, 'config.json'), JSON.stringify(config), 'utf8')
}
