import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import {
  parseArgs,
  parseProfileSpecifier,
  loadProfile,
  parseSimpleYaml
} from '../../src/scripts/lib/profile-utils.js'

import { FRAMEWORK_ROOT } from '../../src/scripts/lib/resolve-context.js'

const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

function makeTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

// ── parseArgs ──────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  it('解析位置参数和长选项', () => {
    const { positional, options } = parseArgs(['feature-login', '--profile', 'backend', '--skip', '--task=123'])

    expect(positional).toEqual(['feature-login'])
    expect(options).toEqual({ profile: 'backend', skip: true, task: '123' })
  })

  it('解析短标志 -p 为 profile', () => {
    const { options } = parseArgs(['-p', 'frontend'])
    expect(options.profile).toBe('frontend')
  })

  it('解析短标志 -y 为布尔值 true', () => {
    const { options } = parseArgs(['-y'])
    expect(options.yes).toBe(true)
  })

  it('解析短标志 -h 为布尔值 true', () => {
    const { options } = parseArgs(['-h'])
    expect(options.help).toBe(true)
  })

  it('解析短标志 -t 为 target', () => {
    const { options } = parseArgs(['-t', '/tmp/project'])
    expect(options.target).toBe('/tmp/project')
  })

  it('解析 --key=value 语法', () => {
    const { options } = parseArgs(['--profile=mobile:ios'])
    expect(options.profile).toBe('mobile:ios')
  })

  it('解析无值的布尔标志', () => {
    const { options } = parseArgs(['--dry-run', '--verbose'])
    expect(options['dry-run']).toBe(true)
    expect(options.verbose).toBe(true)
  })

  it('空参数返回空数组和空对象', () => {
    const { positional, options } = parseArgs([])
    expect(positional).toEqual([])
    expect(options).toEqual({})
  })

  it('多个位置参数均被收集', () => {
    const { positional } = parseArgs(['feature-a', 'TASK-BE-01', '--profile', 'backend'])
    expect(positional).toEqual(['feature-a', 'TASK-BE-01'])
  })
})

// ── parseProfileSpecifier ──────────────────────────────────────────────────

describe('parseProfileSpecifier', () => {
  it('解析 backend', () => {
    const result = parseProfileSpecifier('backend')
    expect(result).toMatchObject({ profile: 'backend', team: 'backend', platform: null })
  })

  it('解析 frontend', () => {
    const result = parseProfileSpecifier('frontend')
    expect(result).toMatchObject({ profile: 'frontend', team: 'frontend', platform: null })
  })

  it('解析 mobile:ios，包含 platformLabel', () => {
    const result = parseProfileSpecifier('mobile:ios')
    expect(result).toMatchObject({
      profile: 'mobile:ios',
      team: 'mobile',
      platform: 'ios',
      platformLabel: 'iOS'
    })
  })

  it('解析 mobile:android', () => {
    const result = parseProfileSpecifier('mobile:android')
    expect(result).toMatchObject({ platform: 'android', platformLabel: 'Android' })
  })

  it('解析 mobile:harmony', () => {
    const result = parseProfileSpecifier('mobile:harmony')
    expect(result).toMatchObject({ platform: 'harmony', platformLabel: 'HarmonyOS' })
  })

  it('mobile 不带平台时 platform 为 null', () => {
    const result = parseProfileSpecifier('mobile')
    expect(result.platform).toBeNull()
  })

  it('非 mobile team 带平台后缀时报错', () => {
    expect(() => parseProfileSpecifier('frontend:ios')).toThrow(/不需要平台后缀/)
    expect(() => parseProfileSpecifier('backend:ios')).toThrow(/不需要平台后缀/)
  })

  it('mobile 带无效平台时报错', () => {
    expect(() => parseProfileSpecifier('mobile:web')).toThrow(/无效的移动端平台/)
    expect(() => parseProfileSpecifier('mobile:unknown')).toThrow(/无效的移动端平台/)
  })

  it('无效的 team 名报错', () => {
    expect(() => parseProfileSpecifier('unknown')).toThrow(/无效的 profile/)
  })

  it('空字符串返回 null', () => {
    expect(parseProfileSpecifier('')).toBeNull()
    expect(parseProfileSpecifier(null)).toBeNull()
    expect(parseProfileSpecifier(undefined)).toBeNull()
  })
})

// ── parseSimpleYaml ────────────────────────────────────────────────────────

describe('parseSimpleYaml', () => {
  it('解析简单键值对', () => {
    const result = parseSimpleYaml('name: backend\nversion: 1\n')
    expect(result).toEqual({ name: 'backend', version: 1 })
  })

  it('解析布尔值', () => {
    const result = parseSimpleYaml('enabled: true\ndisabled: false\n')
    expect(result).toEqual({ enabled: true, disabled: false })
  })

  it('解析 null 值', () => {
    const result = parseSimpleYaml('value: null\n')
    expect(result.value).toBeNull()
  })

  it('解析数字', () => {
    const result = parseSimpleYaml('count: 42\nrate: 3.14\nneg: -5\n')
    expect(result).toEqual({ count: 42, rate: 3.14, neg: -5 })
  })

  it('解析带引号的字符串', () => {
    const result = parseSimpleYaml('greeting: "hello world"\nname: \'foo bar\'\n')
    expect(result).toEqual({ greeting: 'hello world', name: 'foo bar' })
  })

  it('解析嵌套对象', () => {
    const result = parseSimpleYaml('paths:\n  src: src/\n  test: test/\n')
    expect(result).toEqual({ paths: { src: 'src/', test: 'test/' } })
  })

  it('解析数组', () => {
    const result = parseSimpleYaml('layers:\n  - hooks\n  - services\n  - types\n')
    expect(result).toEqual({ layers: ['hooks', 'services', 'types'] })
  })

  it('忽略注释行', () => {
    const result = parseSimpleYaml('# 这是注释\nname: backend\n# 另一行注释\n')
    expect(result).toEqual({ name: 'backend' })
  })

  it('行内注释被忽略', () => {
    const result = parseSimpleYaml('name: backend # 行内注释\n')
    expect(result).toEqual({ name: 'backend' })
  })

  it('空内容返回空对象', () => {
    expect(parseSimpleYaml('')).toEqual({})
    expect(parseSimpleYaml('# 只有注释\n')).toEqual({})
  })

  it('解析内联数组', () => {
    const result = parseSimpleYaml('tags: [a, b, c]\n')
    expect(result).toEqual({ tags: ['a', 'b', 'c'] })
  })

  it('frameworkRoot 配置文件可正常解析', () => {
    const yaml = `# Harness Workflow 用户全局配置\nframeworkRoot: /Users/test/.hx\n`
    const result = parseSimpleYaml(yaml)
    expect(result.frameworkRoot).toBe('/Users/test/.hx')
  })
})

// ── loadProfile ────────────────────────────────────────────────────────────

describe('loadProfile', () => {
  it('加载内置 backend profile', () => {
    const profile = loadProfile(FRAMEWORK_ROOT, 'backend')
    expect(profile.team).toBe('backend')
    expect(profile.profile).toBe('backend')
    expect(profile.label).toBeTruthy()
    expect(typeof profile.gateCommands).toBe('object')
  })

  it('加载内置 frontend profile', () => {
    const profile = loadProfile(FRAMEWORK_ROOT, 'frontend')
    expect(profile.team).toBe('frontend')
    expect(profile.profile).toBe('frontend')
  })

  it('加载 mobile:ios profile，平台信息正确', () => {
    const profile = loadProfile(FRAMEWORK_ROOT, 'mobile:ios')
    expect(profile.team).toBe('mobile')
    expect(profile.platform).toBe('ios')
    expect(profile.platformLabel).toBe('iOS')
    expect(profile.profile).toBe('mobile:ios')
  })

  it('加载 mobile:android profile', () => {
    const profile = loadProfile(FRAMEWORK_ROOT, 'mobile:android')
    expect(profile.platform).toBe('android')
    expect(profile.platformLabel).toBe('Android')
  })

  it('加载 mobile:harmony profile', () => {
    const profile = loadProfile(FRAMEWORK_ROOT, 'mobile:harmony')
    expect(profile.platform).toBe('harmony')
  })

  it('返回 files 对象，包含 profilePath 等路径', () => {
    const profile = loadProfile(FRAMEWORK_ROOT, 'backend')
    expect(profile.files).toBeTruthy()
    expect(profile.files.profilePath).toContain('profile.yaml')
    expect(profile.files.requirementTemplatePath).toContain('requirement-template.md')
    expect(profile.files.planTemplatePath).toContain('plan-template.md')
    expect(profile.files.reviewChecklistPath).toContain('review-checklist.md')
    expect(profile.files.goldenRulesPath).toContain('golden-rules.md')
  })

  it('自定义 profile 文件不存在时抛出错误', () => {
    expect(() => loadProfile(FRAMEWORK_ROOT, 'nonexistent-team')).toThrow(/profile 文件不存在/)
  })

  it('通过 searchRoots 选项支持自定义查找路径', () => {
    const customRoot = makeTempDir('load-profile-custom-')
    const profileDir = resolve(customRoot, 'profiles', 'myteam')
    mkdirSync(profileDir, { recursive: true })
    writeFileSync(resolve(profileDir, 'profile.yaml'), [
      'label: My Team',
      'task_prefix: MT',
      'gate_commands:',
      '  lint: echo lint-ok'
    ].join('\n'), 'utf8')

    const profile = loadProfile(FRAMEWORK_ROOT, 'myteam', {
      searchRoots: [customRoot, FRAMEWORK_ROOT]
    })

    expect(profile.team).toBe('myteam')
    expect(profile.label).toBe('My Team')
    expect(profile.taskPrefix).toBe('MT')
  })
})
