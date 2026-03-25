/**
 * hooks-utils.js — Hook 加载工具
 *
 * 支持两种方式定义 hook：
 *
 * 1. 约定式（文件存在即自动加载）：
 *    ~/.hx/hooks/<cmd>-pre.md     用户全局前置 hook
 *    .hx/hooks/<cmd>-pre.md       项目级前置 hook
 *    ~/.hx/hooks/<cmd>-post.md    用户全局后置 hook
 *    .hx/hooks/<cmd>-post.md      项目级后置 hook
 *
 * 2. 配置式（在 .hx/config.json 中显式声明）：
 *    {
 *      "hooks": {
 *        "run": {
 *          "pre": [".hx/hooks/extra.md"],
 *          "post": ["~/.hx/skills/team-style.md"]
 *        }
 *      }
 *    }
 *
 * 加载顺序（pre）：全局约定 → 项目约定 → 配置式（按数组顺序）
 * 加载顺序（post）：全局约定 → 项目约定 → 配置式（按数组顺序）
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { homedir } from 'os'

const HOME = homedir()

/**
 * 解析路径：支持 ~ 开头的 home 目录
 */
function resolvePath(filePath, projectRoot) {
  if (filePath.startsWith('~/')) {
    return resolve(HOME, filePath.slice(2))
  }
  return resolve(projectRoot, filePath)
}

/**
 * 安全读取文件，不存在返回 null
 */
function safeRead(filePath) {
  if (!existsSync(filePath)) return null
  try {
    const content = readFileSync(filePath, 'utf8').trim()
    return content || null
  } catch {
    return null
  }
}

/**
 * 加载单个方向（pre 或 post）的所有 hook 内容。
 *
 * @param {string} commandName - 命令名，如 'run' / 'doc' / 'plan'
 * @param {'pre'|'post'} phase - 阶段
 * @param {string} projectRoot - 项目根目录
 * @param {object} config - 合并后的 .hx/config.json
 * @returns {string[]} 各 hook 文件的内容数组（已过滤空值）
 */
function loadPhaseHooks(commandName, phase, projectRoot, config) {
  const parts = []

  // 1. 约定式：用户全局
  const globalConvention = resolve(HOME, `.hx/hooks/${commandName}-${phase}.md`)
  const globalContent = safeRead(globalConvention)
  if (globalContent) parts.push({ source: globalConvention, content: globalContent })

  // 2. 约定式：项目级
  const projectConvention = resolve(projectRoot, `.hx/hooks/${commandName}-${phase}.md`)
  const projectContent = safeRead(projectConvention)
  if (projectContent) parts.push({ source: projectConvention, content: projectContent })

  // 3. 配置式：读取 hooks.<cmd>.pre/post 数组
  const configHooks = config?.hooks?.[commandName]?.[phase]
  if (Array.isArray(configHooks)) {
    const seen = new Set([globalConvention, projectConvention])
    for (const filePath of configHooks) {
      const absPath = resolvePath(filePath, projectRoot)
      if (seen.has(absPath)) continue // 去重
      seen.add(absPath)
      const content = safeRead(absPath)
      if (content) parts.push({ source: absPath, content })
    }
  }

  return parts
}

/**
 * 加载命令的 pre/post hook 内容。
 *
 * @param {object} ctx - resolveContext() 返回的上下文
 * @param {string} commandName - 命令名，如 'run' / 'doc' / 'fix'
 * @returns {{ pre: string, post: string, hasPre: boolean, hasPost: boolean }}
 */
export function loadHooks(ctx, commandName) {
  const preParts = loadPhaseHooks(commandName, 'pre', ctx.projectRoot, ctx.config)
  const postParts = loadPhaseHooks(commandName, 'post', ctx.projectRoot, ctx.config)

  const formatSection = (parts, phase) => {
    if (parts.length === 0) return ''
    const label = phase === 'pre' ? '前置自定义约束（Hook Pre）' : '后置自定义检查（Hook Post）'
    return [
      `**${label}：**`,
      ...parts.map(p => p.content),
    ].join('\n\n')
  }

  const pre = formatSection(preParts, 'pre')
  const post = formatSection(postParts, 'post')

  return {
    pre,
    post,
    hasPre: pre.length > 0,
    hasPost: post.length > 0,
  }
}

/**
 * 将 hook 内容注入到 prompt 字符串中。
 *
 * @param {string} prompt - 原始 prompt
 * @param {{ pre: string, post: string }} hooks - loadHooks() 的返回值
 * @returns {string} 注入后的 prompt
 */
export function injectHooks(prompt, hooks) {
  const parts = []
  if (hooks.hasPre) parts.push(hooks.pre)
  parts.push(prompt)
  if (hooks.hasPost) parts.push(hooks.post)
  return parts.join('\n\n')
}
