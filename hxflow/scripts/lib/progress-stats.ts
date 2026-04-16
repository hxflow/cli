export interface ProgressStats {
  total: number
  done: number
  inProgress: number
  pending: number
}

/**
 * 从 progress data 计算任务统计摘要。
 */
export function computeProgressStats(data: { tasks: { status: string }[] }): ProgressStats {
  const total = data.tasks.length
  const done = data.tasks.filter((t) => t.status === 'done').length
  const inProgress = data.tasks.filter((t) => t.status === 'in-progress').length
  const pending = total - done - inProgress
  return { total, done, inProgress, pending }
}
