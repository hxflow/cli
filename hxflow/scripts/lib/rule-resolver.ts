import { existsSync } from 'fs'
import { resolve } from 'path'

import { readRuleTemplateConfig, type RuleTemplateConfig } from './runtime-config.ts'

export type RuleTemplateKey = keyof RuleTemplateConfig

export function resolveRequiredRuleTemplatePath(projectRoot: string, configKey: RuleTemplateKey): string {
  const configuredTemplates = readRuleTemplateConfig(projectRoot)
  const configuredPath = configuredTemplates[configKey]

  if (!configuredPath) {
    throw new Error(`.hx/config.yaml 缺少 rules.templates.${configKey} 配置`)
  }

  const resolvedPath = resolve(projectRoot, configuredPath)
  if (!existsSync(resolvedPath)) {
    throw new Error(`.hx/config.yaml 的 rules.templates.${configKey} 指向的模板不存在: ${resolvedPath}`)
  }

  return resolvedPath
}
