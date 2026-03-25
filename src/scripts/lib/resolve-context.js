/**
 * resolve-context.js — 路径解耦核心
 *
 * 分离三层路径：
 *   FRAMEWORK_ROOT — npm 包安装位置（内置 profiles、模板，只读）
 *   USER_HX_DIR    — 用户全局目录 ~/.hx/（用户级 profiles、全局配置）
 *   PROJECT_ROOT   — 用户项目根目录（源码、.claude/）
 *
 * 配置优先级（低 → 高）：
 *   内置默认值 → ~/.hx/config.json → <project>/.hx/config.json
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const HX_CONFIG_FILE = '.hx/config.json'

/** 框架自身的根目录（scripts/lib/ 向上两级） */
export const FRAMEWORK_ROOT = resolve(__dirname, '../..')

/** 用户全局 hx 目录 */
export const USER_HX_DIR = resolve(homedir(), '.hx')

/**
 * 向上搜索项目根目录。
 * 优先找 .hx/config.json，最后找 .git（通用项目根标记）。
 */
export function findProjectRoot(startDir) {
  let dir = resolve(startDir || process.cwd())
  const root = resolve('/')

  while (dir !== root) {
    if (existsSync(resolve(dir, HX_CONFIG_FILE))) return dir
    if (existsSync(resolve(dir, '.git'))) return dir
    dir = dirname(dir)
  }

  // 找不到就用 cwd
  return resolve(startDir || process.cwd())
}

/**
 * 加载项目级配置。
 * 仅读取 .hx/config.json。
 */
function loadProjectConfig(projectRoot) {
  const newPath = resolve(projectRoot, HX_CONFIG_FILE)
  if (existsSync(newPath)) {
    try {
      const parsed = JSON.parse(readFileSync(newPath, 'utf8'))
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  return {}
}

/**
 * 加载用户全局配置 (~/.hx/config.json)。
 */
export function loadUserConfig() {
  const configPath = resolve(USER_HX_DIR, 'config.json')
  if (!existsSync(configPath)) return {}

  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * 浅合并配置对象（嵌套对象做一层 merge，数组直接覆盖）。
 */
function mergeConfigs(...configs) {
  const result = {}
  for (const config of configs) {
    for (const [key, value] of Object.entries(config)) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        result[key] !== null &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = { ...result[key], ...value }
      } else {
        result[key] = value
      }
    }
  }
  return result
}

/**
 * 构建 profile 查找根目录列表（优先级高→低）：
 *   <project>/.hx → ~/.hx → FRAMEWORK_ROOT
 *
 * @param {string} projectRoot - 项目根目录
 */
export function buildProfileSearchRoots(projectRoot) {
  return [resolve(projectRoot, '.hx'), USER_HX_DIR, FRAMEWORK_ROOT]
}

/**
 * 解析完整的上下文路径。
 * 三层配置合并：内置默认值 ← 用户全局 ← 项目级。
 *
 * @param {string} [cwd] - 起始目录，默认 process.cwd()
 * @returns 所有路径信息
 */
export function resolveContext(cwd) {
  const projectRoot = findProjectRoot(cwd)
  const userConfig = loadUserConfig()
  const projectConfig = loadProjectConfig(projectRoot)
  const config = mergeConfigs(userConfig, projectConfig)
  const paths = config.paths || {}
  return {
    // 框架本身（只读资源）
    frameworkRoot: FRAMEWORK_ROOT,

    // 用户全局目录
    userHxDir: USER_HX_DIR,

    // 用户项目
    projectRoot,

    // 可配置路径（从合并配置读取，有默认值）
    requirementDir: resolve(projectRoot, paths.requirement || 'docs/requirement'),
    plansDir: resolve(projectRoot, paths.plans || 'docs/plans'),
    srcDir: resolve(projectRoot, paths.src || 'src'),
    agentsPath: resolve(projectRoot, paths.agents || 'AGENTS.md'),

    // 框架内置资源（始终从 FRAMEWORK_ROOT 读取）
    goldenPrinciplesPath: resolve(FRAMEWORK_ROOT, 'docs', 'golden-principles.md'),
    mapPath: resolve(FRAMEWORK_ROOT, 'docs', 'map.md'),

    // 原始配置（合并后）
    config,
    defaultProfile: config.defaultProfile || null
  }
}
