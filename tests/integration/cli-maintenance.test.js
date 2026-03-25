import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
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

// ── hx-init ────────────────────────────────────────────────────────────────

describe('hx-init', () => {
  it('prints help and exits 0 with --help', () => {
    const result = runScript(ROOT, 'src/scripts/hx-init.js', ['--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('hx init')
  })

  it('creates docs/, AGENTS.md and .claude/commands/ in a new project', () => {
    const targetRoot = makeTempDir('hx-init-fresh-')

    const result = runScript(ROOT, 'src/scripts/hx-init.js', ['--target', targetRoot, '--profile', 'backend'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('init')
    expect(existsSync(resolve(targetRoot, 'docs/requirement'))).toBe(true)
    expect(existsSync(resolve(targetRoot, 'docs/plans'))).toBe(true)
    expect(existsSync(resolve(targetRoot, '.hx/config.json'))).toBe(true)
    expect(existsSync(resolve(targetRoot, 'AGENTS.md'))).toBe(true)
    expect(existsSync(resolve(targetRoot, '.claude/commands/hx-run.md'))).toBe(true)
  })

  it('is idempotent — second run skips existing files', () => {
    const targetRoot = makeTempDir('hx-init-idempotent-')

    runScript(ROOT, 'src/scripts/hx-init.js', ['--target', targetRoot, '--profile', 'backend'])
    const second = runScript(ROOT, 'src/scripts/hx-init.js', ['--target', targetRoot, '--profile', 'backend'])

    expect(second.status).toBe(0)
    expect(second.stdout).toContain('已存在')
  })
})

// ── hx-upgrade ────────────────────────────────────────────────────────────

describe('hx-upgrade', () => {
  it('prints help and exits 0 with --help', () => {
    const result = runScript(ROOT, 'src/scripts/hx-upgrade.js', ['--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('hx upgrade')
  })

  it('dry-run shows update/skip report without writing files', () => {
    const targetRoot = installProject('hx-upgrade-dry-', 'frontend')

    const result = runScript(ROOT, 'src/scripts/hx-upgrade.js', ['--target', targetRoot, '--dry-run'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('dry-run')
    expect(result.stdout).toMatch(/更新:|跳过:/)
  })

  it('upgrades .claude/commands/ files in an installed project', () => {
    const targetRoot = installProject('hx-upgrade-real-', 'frontend')

    const result = runScript(ROOT, 'src/scripts/hx-upgrade.js', ['--target', targetRoot])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('完成')
    expect(existsSync(resolve(targetRoot, '.claude/commands/hx-run.md'))).toBe(true)
  })

  it('skips pinned commands when pinnedCommands is set in .hx/config.json', () => {
    const targetRoot = installProject('hx-upgrade-pinned-', 'frontend')
    // Mutate the installed hx-run.md so upgrade would normally overwrite it
    const cmdPath = resolve(targetRoot, '.claude/commands/hx-run.md')
    writeFileSync(cmdPath, '# custom hx-run\n', 'utf8')
    // Pin hx-run so upgrade skips it
    writeFileSync(
      resolve(targetRoot, '.hx/config.json'),
      JSON.stringify({ defaultProfile: 'frontend', pinnedCommands: ['hx-run'] }),
      'utf8'
    )

    const result = runScript(ROOT, 'src/scripts/hx-upgrade.js', ['--target', targetRoot])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('已固定')
    // Custom content must be preserved
    expect(readFileSync(cmdPath, 'utf8')).toBe('# custom hx-run\n')
  })
})

// ── hx-uninstall ──────────────────────────────────────────────────────────

describe('hx-uninstall', () => {
  it('prints help and exits 0 with --help', () => {
    const result = runScript(ROOT, 'src/scripts/hx-uninstall.js', ['--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('hx uninstall')
  })

  it('exits 0 with no-op message when no installation found', () => {
    const targetRoot = makeTempDir('hx-uninstall-empty-')

    const result = runScript(ROOT, 'src/scripts/hx-uninstall.js', ['--target', targetRoot, '--yes'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('未发现')
  })

  it('dry-run lists items to remove without deleting them', () => {
    const targetRoot = installProject('hx-uninstall-dry-', 'backend')

    const result = runScript(ROOT, 'src/scripts/hx-uninstall.js', ['--target', targetRoot, '--dry-run'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('dry-run')
    expect(result.stdout).toContain('.claude/commands/')
    expect(existsSync(resolve(targetRoot, '.claude/commands/hx-run.md'))).toBe(true)
  })

  it('removes hx command files and exits 0 with --yes', () => {
    const targetRoot = installProject('hx-uninstall-real-', 'backend')

    const result = runScript(ROOT, 'src/scripts/hx-uninstall.js', ['--target', targetRoot, '--yes'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('卸载完成')
    expect(existsSync(resolve(targetRoot, '.claude/commands/hx-run.md'))).toBe(false)
  })
})

// ── hx-gate ───────────────────────────────────────────────────────────────

describe('hx-gate', () => {
  it('runs gate steps and exits 0 when all commands succeed', () => {
    const targetRoot = makeProjectWithEchoProfile('hx-gate-pass-')

    const result = runScript(targetRoot, 'src/scripts/hx-gate.js', ['--profile', 'echo-team'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('门控全部通过')
  })

  it('exits 1 when the profile has no gate_commands defined', () => {
    const targetRoot = makeProjectWithProfile('hx-gate-empty-', 'label: "Empty Team"\ngate_commands: {}\n')

    const result = runScript(targetRoot, 'src/scripts/hx-gate.js', ['--profile', 'empty-team'])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('未定义 gate_commands')
  })

  it('exits 1 when the profile file does not exist', () => {
    const targetRoot = installProject('hx-gate-missing-', 'backend')

    const result = runScript(targetRoot, 'src/scripts/hx-gate.js', ['--profile', 'nonexistent'])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('profile 文件不存在')
  })
})

// ── hx-entropy-scan ───────────────────────────────────────────────────────

describe('hx-entropy-scan', () => {
  it('exits 0 with info message when src/ is empty or missing', () => {
    const targetRoot = installProject('hx-entropy-empty-', 'backend')

    const result = runScript(targetRoot, 'src/scripts/hx-entropy-scan.js', [])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('src/')
  })

  it('reports console.log and throw new Error patterns in src/ TS files', () => {
    const targetRoot = installProject('hx-entropy-hits-', 'backend')
    mkdirSync(resolve(targetRoot, 'src'), { recursive: true })
    writeFileSync(
      resolve(targetRoot, 'src/order.ts'),
      'console.log("debug")\nthrow new Error("oops")\n',
      'utf8'
    )

    const result = runScript(targetRoot, 'src/scripts/hx-entropy-scan.js', [])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('GP-001')
    expect(result.stdout).toContain('GP-003')
    expect(result.stdout).toContain('console.log 未清理')
    expect(result.stdout).toContain('裸 Error 抛出')
  })

  it('exits 0 with clean message when no patterns found', () => {
    const targetRoot = installProject('hx-entropy-clean-', 'backend')
    mkdirSync(resolve(targetRoot, 'src'), { recursive: true })
    writeFileSync(
      resolve(targetRoot, 'src/order.ts'),
      'export function getOrder(): string { return "ok" }\n',
      'utf8'
    )

    const result = runScript(targetRoot, 'src/scripts/hx-entropy-scan.js', [])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('未发现问题')
  })
})

// ── hx-doc-freshness ──────────────────────────────────────────────────────

describe('hx-doc-freshness', () => {
  it('exits 0 with skip message when not in a git repo', () => {
    const targetRoot = installProject('hx-freshness-nogit-', 'backend')

    const result = runScript(targetRoot, 'src/scripts/hx-doc-freshness.js', [])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Git')
  })

  it('exits 0 when requirement directory has no user docs', () => {
    const targetRoot = installProject('hx-freshness-nodoc-', 'backend')
    spawnSync('git', ['init'], { cwd: targetRoot, encoding: 'utf8' })

    const result = runScript(targetRoot, 'src/scripts/hx-doc-freshness.js', [])

    // Either no docs found (template-only dir) or freshness check passed — both are exit 0
    expect(result.status).toBe(0)
  })
})

// ── hx-check ──────────────────────────────────────────────────────────────

describe('hx-check', () => {
  it('exits 1 when ctx check fails (AGENTS.md missing)', () => {
    const targetRoot = makeTempDir('hx-check-fail-')
    writeProjectConfig(targetRoot, { defaultProfile: 'backend' })

    const result = runScript(targetRoot, 'src/scripts/hx-check.js', ['--profile', 'backend'])

    expect(result.status).toBe(1)
  })

  it('runs ctx and gate in sequence and exits 0 when both pass', () => {
    const targetRoot = makeProjectWithEchoProfile('hx-check-pass-')
    // Set default profile to echo-team so gate uses echo commands
    writeProjectConfig(targetRoot, { defaultProfile: 'echo-team' })
    // Create doc + plan to satisfy ctx check
    expect(runScript(targetRoot, 'src/scripts/hx-new-doc.js', ['order-search']).status).toBe(0)
    expect(runScript(targetRoot, 'src/scripts/hx-new-plan.js', ['order-search']).status).toBe(0)

    const result = runScript(targetRoot, 'src/scripts/hx-check.js', ['--profile', 'echo-team'])

    expect(result.status).toBe(0)
  })
})

// ── hx-mr ─────────────────────────────────────────────────────────────────

describe('hx-mr', () => {
  it('exits 1 with usage when no feature name given', () => {
    const targetRoot = installProject('hx-mr-noarg-', 'backend')

    const result = runScript(targetRoot, 'src/scripts/hx-mr.js', [])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('hx mr <feature-name>')
  })

  it('exits 1 when feature docs do not exist', () => {
    const targetRoot = installProject('hx-mr-nodoc-', 'backend')

    const result = runScript(targetRoot, 'src/scripts/hx-mr.js', ['nonexistent-feature'])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('未找到特性文档')
  })

  it('outputs MR context with requirement and progress when docs exist', () => {
    const targetRoot = installProject('hx-mr-ok-', 'backend')
    expect(runScript(targetRoot, 'src/scripts/hx-new-doc.js', ['order-search']).status).toBe(0)
    expect(runScript(targetRoot, 'src/scripts/hx-new-plan.js', ['order-search']).status).toBe(0)

    const result = runScript(targetRoot, 'src/scripts/hx-mr.js', ['order-search', '--project', 'team/backend', '--target', 'develop'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('MR 创建上下文')
    expect(result.stdout).toContain('order-search')
    expect(result.stdout).toContain('任务进度')
    expect(result.stdout).toContain('team/backend')
    expect(result.stdout).toContain('develop')
  })
})

// ── helpers ───────────────────────────────────────────────────────────────

function runScript(cwd, scriptPath, args) {
  const abs = resolve(ROOT, scriptPath)
  return spawnSync(process.execPath, [abs, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' }
  })
}

function makeTempDir(prefix) {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function installProject(prefix, profile) {
  const targetRoot = makeTempDir(prefix)
  const install = runScript(ROOT, 'src/scripts/hx-install.cjs', [targetRoot, '--yes', '--profile', profile, '--skip-install'])
  expect(install.status).toBe(0)
  return targetRoot
}

/** Creates a project with a custom profile containing echo gate commands and all required resource files */
function makeProjectWithEchoProfile(prefix) {
  const targetRoot = installProject(prefix, 'backend')
  const profileDir = resolve(targetRoot, '.hx/profiles/echo-team')
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(resolve(profileDir, 'profile.yaml'), [
    'label: Echo Team',
    'task_prefix: ET',
    'gate_commands:',
    '  lint: "echo lint-ok"',
    '  test: "echo test-ok"',
    'task_split:',
    '  order:',
    '    - impl',
    '  template:',
    '    - id: "TASK-{PREFIX}-01"',
    '      name: "实现功能"',
    '      output: "src/index.ts"',
    '      description: "实现{Feature}功能"'
  ].join('\n'), 'utf8')
  // ctx check requires these profile resource files to exist
  writeFileSync(resolve(profileDir, 'requirement-template.md'), '# 需求文档\n\n## 验收标准\n\n- AC-01: 功能正常运行\n', 'utf8')
  writeFileSync(resolve(profileDir, 'plan-template.md'), '# 执行计划\n## 任务列表\n```\n```\n## 依赖关系\n```\n```\n', 'utf8')
  writeFileSync(resolve(profileDir, 'review-checklist.md'), '# Review 清单\n- Echo Team 检查项\n', 'utf8')
  writeFileSync(resolve(profileDir, 'golden-rules.md'), '# 黄金规则\n', 'utf8')
  return targetRoot
}

/** Creates a minimal project with a named custom profile under .hx/profiles/ */
function makeProjectWithProfile(prefix, profileYaml) {
  const targetRoot = installProject(prefix, 'backend')
  const profileDir = resolve(targetRoot, '.hx/profiles/empty-team')
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(resolve(profileDir, 'profile.yaml'), profileYaml, 'utf8')
  return targetRoot
}

function writeProjectConfig(root, config) {
  const hxDir = resolve(root, '.hx')
  mkdirSync(hxDir, { recursive: true })
  writeFileSync(resolve(hxDir, 'config.json'), JSON.stringify(config), 'utf8')
}
