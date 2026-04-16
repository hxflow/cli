import { resolveProgressFile } from './file-paths.ts'
import { validateProgressFile } from './progress-schema.ts'
import type { ProgressData } from './types.ts'

export function loadValidatedProgressFile(filePath: string): { filePath: string; data: ProgressData } {
  const validation = validateProgressFile(filePath)

  if (!validation.valid || !validation.data) {
    throw new Error(`progressFile 校验失败: ${validation.errors[0]}`)
  }

  return {
    filePath,
    data: validation.data as ProgressData,
  }
}

export function loadFeatureProgress(projectRoot: string, feature: string) {
  const { filePath, restored } = resolveProgressFile(projectRoot, feature)
  const { data } = loadValidatedProgressFile(filePath)

  return {
    filePath,
    restored,
    data,
  }
}
