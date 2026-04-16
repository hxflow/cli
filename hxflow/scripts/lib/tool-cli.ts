import { parseArgs } from './config-utils.ts'
import { findProjectRoot, getSafeCwd } from './resolve-context.ts'

/**
 * 有子命令的工具入口（如 doc context / doc validate）。
 */
export function createToolContext(argv = process.argv.slice(2)) {
  const cwd = getSafeCwd()
  const [sub, ...rest] = argv
  const { positional, options } = parseArgs(rest)

  return {
    cwd,
    sub,
    rest,
    positional,
    options,
    projectRoot: findProjectRoot(cwd),
  }
}

/**
 * 无子命令的工具入口（如 init）。
 */
export function createSimpleContext(argv = process.argv.slice(2)) {
  const cwd = getSafeCwd()
  const { positional, options } = parseArgs(argv)

  return {
    cwd,
    positional,
    options,
    projectRoot: findProjectRoot(cwd),
  }
}
