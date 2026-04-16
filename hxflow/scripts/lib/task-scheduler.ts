import type { ProgressData, ProgressTask, ScheduledBatch } from './types.ts'

/**
 * 从 progressData 中找出所有「可恢复」的 in-progress task。
 */
export function getRecoverableTasks(progressData: ProgressData): ProgressTask[] {
  const doneIds = new Set(
    progressData.tasks.filter((t) => t.status === 'done').map((t) => t.id)
  )

  return progressData.tasks.filter(
    (t) =>
      t.status === 'in-progress' &&
      t.startedAt !== null &&
      t.completedAt === null &&
      t.dependsOn.every((depId) => doneIds.has(depId))
  )
}

/**
 * 从 progressData 中找出所有「可运行」的 pending task。
 */
export function getRunnableTasks(progressData: ProgressData): ProgressTask[] {
  const doneIds = new Set(
    progressData.tasks.filter((t) => t.status === 'done').map((t) => t.id)
  )

  return progressData.tasks.filter(
    (t) =>
      t.status === 'pending' && t.dependsOn.every((depId) => doneIds.has(depId))
  )
}

/**
 * 获取当前应执行的任务批次。
 */
export function getScheduledBatch(progressData: ProgressData): ScheduledBatch {
  const recoverable = getRecoverableTasks(progressData)

  if (recoverable.length > 0) {
    const parallel =
      recoverable.length > 1 && recoverable.every((t) => t.parallelizable)
    return { tasks: recoverable, parallel, mode: 'recover' }
  }

  const runnable = getRunnableTasks(progressData)

  if (runnable.length === 0) {
    return { tasks: [], parallel: false, mode: 'done' }
  }

  const parallel = runnable.length > 1 && runnable.every((t) => t.parallelizable)
  return { tasks: runnable, parallel, mode: 'run' }
}
