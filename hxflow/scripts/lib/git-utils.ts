import { spawnSync } from 'child_process'

/**
 * 在指定目录执行 git 命令，返回 stdout（成功）或 null（失败）。
 */
export function runGit(cwd: string, ...args: string[]): string | null {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

/**
 * 将多行文本拆为非空行数组。
 */
export function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

const PROTECTED_BRANCHES = new Set(['main', 'master', 'develop'])
const VALID_BRANCH_PATTERN = /^(feat|fix|bugfix|refactor|chore|docs|test|hotfix)\/[a-zA-Z0-9_-]+$/

export interface BranchCheckResult {
  ok: boolean
  branch: string
  reason: string | null
}

/**
 * 检查当前分支名是否符合 `<type>/<scope>` 规范。
 */
export function checkBranchName(cwd: string): BranchCheckResult {
  const branch = runGit(cwd, 'rev-parse', '--abbrev-ref', 'HEAD')
  if (!branch) {
    return { ok: true, branch: '(unknown)', reason: null }
  }
  if (PROTECTED_BRANCHES.has(branch)) {
    return { ok: true, branch, reason: null }
  }
  if (VALID_BRANCH_PATTERN.test(branch)) {
    return { ok: true, branch, reason: null }
  }

  const slug = branch
    .toLowerCase()
    .replace(/[^a-z0-9-_/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const suggested = `feat/${slug}`
  return {
    ok: false,
    branch,
    reason: `分支名 "${branch}" 不符合规范 <type>/<scope>，建议重命名为 "${suggested}"`,
  }
}

/**
 * 获取默认分支名（优先使用指定 target，否则从 remote HEAD 推断）。
 */
export function getDefaultBranch(cwd: string, target?: string | null): string {
  if (target) return target
  const remoteBranch = runGit(cwd, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD')
  return remoteBranch?.replace('origin/', '') ?? 'main'
}
