import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import {
  createTemplateReplacements,
  extractRequirementInfo,
  filterProgressByProfile,
  findProgressByTask,
  getDefaultProfile,
  guessProfileFromTaskId,
  inferProfileFromProgress,
  inferProfileFromRequirementDoc,
  isTaskId,
  isValidFeatureName,
  loadProfile,
  parseArgs,
  parseProfileSpecifier,
  readHxConfig,
  renderTemplate
} from '../../src/scripts/lib/profile-utils.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

describe('profile-utils', () => {
  it('parses positional arguments and long options', () => {
    const parsed = parseArgs(['feature-login', '--profile', 'backend', '--skip-install', '--task=123'])

    expect(parsed.positional).toEqual(['feature-login'])
    expect(parsed.options).toEqual({
      profile: 'backend',
      'skip-install': true,
      task: '123'
    })
  })

  it('parses valid profile specifiers and rejects invalid ones', () => {
    expect(parseProfileSpecifier('mobile:ios')).toMatchObject({
      profile: 'mobile:ios',
      team: 'mobile',
      platform: 'ios',
      platformLabel: 'iOS'
    })

    expect(() => parseProfileSpecifier('frontend:ios')).toThrow(/不需要平台后缀/)
    expect(() => parseProfileSpecifier('mobile:web')).toThrow(/无效的移动端平台/)
  })

  it('loads concrete profile data from repository files', () => {
    const profile = loadProfile(resolve(ROOT, 'src'), 'mobile:ios')

    expect(profile.profile).toBe('mobile:ios')
    expect(profile.platformLabel).toBe('iOS')
    expect(profile.taskPrefix).toBe('TASK-IOS')
    expect(profile.files.requirementTemplatePath).toContain('profiles/mobile/requirement-template.md')
    expect(profile.architecture.layers.length).toBeGreaterThan(0)
  })

  it('reads configured default profile from .hx/config.json', () => {
    const tempRoot = makeTempDir('profile-config-')
    writeConfig(tempRoot, { defaultProfile: 'backend' })

    expect(readHxConfig(tempRoot)).toEqual({ defaultProfile: 'backend' })
    expect(getDefaultProfile(tempRoot)).toBe('backend')
  })

  it('falls back to frontend when config is invalid', () => {
    const tempRoot = makeTempDir('profile-config-invalid-')
    writeConfig(tempRoot, { defaultProfile: 'unknown' })

    expect(getDefaultProfile(tempRoot)).toBe('frontend')
  })

  it('ignores harness.config.json entirely', () => {
    const tempRoot = makeTempDir('profile-config-legacy-')
    writeFileSync(resolve(tempRoot, 'harness.config.json'), JSON.stringify({ defaultProfile: 'backend' }), 'utf8')

    expect(readHxConfig(tempRoot)).toEqual({})
    expect(getDefaultProfile(tempRoot)).toBe('frontend')
  })

  it('infers profile from requirement document labels', () => {
    const tempRoot = makeTempDir('profile-doc-')
    mkdirSync(resolve(tempRoot, 'docs/requirement'), { recursive: true })
    writeFileSync(
      resolve(tempRoot, 'docs/requirement/mobile-login.md'),
      '# 需求\n> 团队：移动端｜平台：HarmonyOS (鸿蒙)\n',
      'utf8'
    )

    expect(inferProfileFromRequirementDoc(tempRoot, 'mobile-login')).toBe('mobile:harmony')
  })

  it('extracts AC items and checked layers from requirement content', () => {
    const requirement = extractRequirementInfo(`
- AC-001: 返回 200
- AC-002: 返回 400

## 影响的架构层级
- [x] Services — src/services/
- [X] Hooks - src/hooks/
`)

    expect(requirement.acs).toEqual([
      { id: 'AC-001', text: '返回 200' },
      { id: 'AC-002', text: '返回 400' }
    ])
    expect(requirement.checkedLayers).toEqual(['Services', 'Hooks'])
  })

  it('renders placeholders with brace and bracket forms', () => {
    const output = renderTemplate('Hello {feature-name} [FeatureName] feature-name', {
      'feature-name': 'order-list',
      FeatureName: 'OrderList'
    })

    expect(output).toBe('Hello order-list OrderList order-list')
  })

  it('maps task ids back to default profiles', () => {
    expect(guessProfileFromTaskId('TASK-BE-01')).toBe('backend')
    expect(guessProfileFromTaskId('TASK-IOS-02')).toBe('mobile:ios')
    expect(guessProfileFromTaskId('TASK-XX-01')).toBeNull()
  })

  it('finds progress entries by task and filters them by profile', () => {
    const tempRoot = makeTempDir('profile-progress-')
    const plansDir = resolve(tempRoot, 'docs/plans')

    mkdirSync(plansDir, { recursive: true })
    writeFileSync(
      resolve(plansDir, 'order-search-progress.json'),
      JSON.stringify({
        feature: 'order-search',
        profile: 'backend',
        tasks: [{ id: 'TASK-BE-01', name: 'Repo', status: 'pending' }]
      }),
      'utf8'
    )
    writeFileSync(
      resolve(plansDir, 'mobile-login-progress.json'),
      JSON.stringify({
        feature: 'mobile-login',
        team: 'mobile',
        platform: 'ios',
        tasks: [{ id: 'TASK-IOS-01', name: 'UI', status: 'pending' }]
      }),
      'utf8'
    )

    const progressEntry = findProgressByTask(tempRoot, 'TASK-IOS-01', null, { plansDir })
    const filteredEntries = filterProgressByProfile(
      [
        { data: { profile: 'backend' } },
        { data: { team: 'mobile', platform: 'ios' } },
        { data: { team: 'mobile', platform: 'android' } }
      ],
      'mobile:ios'
    )

    expect(progressEntry?.data.feature).toBe('mobile-login')
    expect(inferProfileFromProgress(progressEntry?.data)).toBe('mobile:ios')
    expect(filteredEntries).toHaveLength(1)
  })

  it('builds template replacements and validates feature/task identifiers', () => {
    const replacements = createTemplateReplacements('order-detail', {
      label: '前端',
      platform: null,
      platformLabel: null,
      taskPrefix: 'TASK-FE',
      paths: {
        platform_src: 'apps/web/src',
        platform_test: 'apps/web/test'
      }
    })

    expect(replacements).toMatchObject({
      feature: 'order-detail',
      Feature: 'OrderDetail',
      PageName: 'OrderDetailPage',
      domain: 'order',
      platform_src: 'apps/web/src',
      PREFIX: 'TASK-FE'
    })
    expect(isValidFeatureName('order-detail-2')).toBe(true)
    expect(isValidFeatureName('OrderDetail')).toBe(false)
    expect(isTaskId('TASK-FE-09')).toBe(true)
    expect(isTaskId('TASK-fe-09')).toBe(false)
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
