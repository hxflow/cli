import { readFileSync } from 'fs'
import type { ProgressData } from './types.ts'

interface ProgressDataRecord extends Record<string, unknown> {
  feature: unknown
  requirementDoc: unknown
  planDoc: unknown
  createdAt: unknown
  updatedAt: unknown
  completedAt: unknown
  lastRun: unknown
  tasks: unknown
}

interface ProgressTaskRecord extends Record<string, unknown> {
  id: unknown
  name: unknown
  status: unknown
  dependsOn: unknown
  parallelizable: unknown
  output: unknown
  startedAt: unknown
  completedAt: unknown
  durationSeconds: unknown
}

interface ProgressTaskWithId extends ProgressTaskRecord {
  id: string
}

interface ProgressLastRunRecord extends Record<string, unknown> {
  taskId: unknown
  taskName: unknown
  status: unknown
  exitStatus: unknown
  exitReason: unknown
  ranAt: unknown
}

function isProgressTaskRecord(value: unknown): value is ProgressTaskRecord {
  return isPlainObject(value)
}

function hasTaskId(task: ProgressTaskRecord): task is ProgressTaskWithId {
  return typeof task.id === 'string' && task.id.trim() !== ''
}

function isProgressLastRunRecord(value: unknown): value is ProgressLastRunRecord {
  return isPlainObject(value)
}

const ISO_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
const TASK_STATUSES = ['pending', 'in-progress', 'done'] as const
const RUN_EXIT_STATUSES = ['succeeded', 'failed', 'aborted', 'blocked', 'timeout'] as const
export const PROGRESS_TOP_LEVEL_KEYS = [
  'feature',
  'requirementDoc',
  'planDoc',
  'createdAt',
  'updatedAt',
  'completedAt',
  'lastRun',
  'tasks',
]
export const PROGRESS_TASK_KEYS = [
  'id',
  'name',
  'status',
  'dependsOn',
  'parallelizable',
  'output',
  'startedAt',
  'completedAt',
  'durationSeconds',
]
export const PROGRESS_LAST_RUN_KEYS = ['taskId', 'taskName', 'status', 'exitStatus', 'exitReason', 'ranAt']
export const PROGRESS_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://hxflow.dev/schemas/progress.schema.json',
  title: 'HXFlow progress.json',
  type: 'object',
  additionalProperties: false,
  required: PROGRESS_TOP_LEVEL_KEYS,
  properties: {
    feature: { type: 'string', minLength: 1 },
    requirementDoc: { type: 'string', minLength: 1 },
    planDoc: { type: 'string', minLength: 1 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    completedAt: { type: ['string', 'null'], format: 'date-time' },
    lastRun: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: PROGRESS_LAST_RUN_KEYS,
          properties: {
            taskId: { type: 'string', minLength: 1 },
            taskName: { type: 'string', minLength: 1 },
            status: { type: 'string', enum: ['in-progress', 'done'] },
            exitStatus: { type: 'string', enum: RUN_EXIT_STATUSES },
            exitReason: { type: 'string' },
            ranAt: { type: 'string', format: 'date-time' },
          },
        },
      ],
    },
    tasks: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: PROGRESS_TASK_KEYS,
        properties: {
          id: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          status: { type: 'string', enum: TASK_STATUSES },
          dependsOn: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
          },
          parallelizable: { type: 'boolean' },
          output: { type: 'string', maxLength: 200 },
          startedAt: { type: ['string', 'null'], format: 'date-time' },
          completedAt: { type: ['string', 'null'], format: 'date-time' },
          durationSeconds: { type: ['integer', 'null'], minimum: 0 },
        },
      },
    },
  },
} as const

export function readProgressFile(filePath: string): ProgressData {
  return JSON.parse(readFileSync(filePath, 'utf8')) as ProgressData
}

export function validateProgressFile(filePath: string): { valid: boolean; filePath: string; data: ProgressData | null; errors: string[] } {
  let data: ProgressData | null = null

  try {
    data = readProgressFile(filePath)
  } catch (error) {
    return {
      valid: false,
      filePath,
      data: null,
      errors: [`progress.json 解析失败: ${error instanceof Error ? error.message : String(error)}`],
    }
  }

  const result = validateProgressData(data)

  return {
    ...result,
    filePath,
    data,
  }
}

export function validateProgressData(data: unknown) {
  const errors: string[] = []

  if (!isPlainObject(data)) {
    return { valid: false, errors: ['progress.json 必须是 object'] }
  }

  const progressData = data as ProgressDataRecord

  validateExactKeys(progressData, PROGRESS_TOP_LEVEL_KEYS, '顶层字段', errors)

  validateNonEmptyString(progressData.feature, 'feature', errors)
  validateNonEmptyString(progressData.requirementDoc, 'requirementDoc', errors)
  validateNonEmptyString(progressData.planDoc, 'planDoc', errors)
  validateIsoDateTime(progressData.createdAt, 'createdAt', errors)
  validateIsoDateTime(progressData.updatedAt, 'updatedAt', errors)
  validateNullableIsoDateTime(progressData.completedAt, 'completedAt', errors)

  validateLastRun(progressData.lastRun, errors)

  if (!Array.isArray(progressData.tasks) || progressData.tasks.length === 0) {
    errors.push('tasks 必须是非空数组')
  } else {
    const taskIds = new Set<string>()
    const tasks = progressData.tasks.filter(isProgressTaskRecord)

    for (const [index, task] of progressData.tasks.entries()) {
      const label = `tasks[${index}]`
      if (!isProgressTaskRecord(task)) {
        errors.push(`${label} 必须是 object`)
        continue
      }

      validateExactKeys(task, PROGRESS_TASK_KEYS, `${label} 字段`, errors)
      validateNonEmptyString(task.id, `${label}.id`, errors)
      validateNonEmptyString(task.name, `${label}.name`, errors)
      validateTaskStatus(task.status, `${label}.status`, errors)
      validateDependsOn(task.dependsOn, `${label}.dependsOn`, errors)

      if (typeof task.parallelizable !== 'boolean') {
        errors.push(`${label}.parallelizable 必须是 boolean`)
      }

      validateOutput(task.output, task.status, label, errors)

      validateNullableIsoDateTime(task.startedAt, `${label}.startedAt`, errors)
      validateNullableIsoDateTime(task.completedAt, `${label}.completedAt`, errors)
      validateNullableDuration(task.durationSeconds, `${label}.durationSeconds`, errors)

      if (task.id) {
        if (taskIds.has(task.id as string)) {
          errors.push(`tasks 中存在重复 id: ${task.id}`)
        } else {
          taskIds.add(task.id as string)
        }
      }
    }

    validateTaskGraph(tasks, errors)
    validateTaskStateConsistency(tasks, errors)
    validateLastRunConsistency(isProgressLastRunRecord(progressData.lastRun) ? progressData.lastRun : null, tasks, errors)
    validateFeatureCompletion(progressData.completedAt, tasks, errors)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

function validateLastRun(value: unknown, errors: string[]) {
  if (value === null) {
    return
  }

  if (!isProgressLastRunRecord(value)) {
    errors.push('lastRun 只能为 null 或固定 6 字段对象')
    return
  }

  validateExactKeys(value, PROGRESS_LAST_RUN_KEYS, 'lastRun 字段', errors)
  validateNonEmptyString(value.taskId, 'lastRun.taskId', errors)
  validateNonEmptyString(value.taskName, 'lastRun.taskName', errors)
  validateLastRunStatus(value.status, 'lastRun.status', errors)
  validateRunExitStatus(value.exitStatus, 'lastRun.exitStatus', errors)
  validateExitReason(value.exitReason, value.exitStatus, 'lastRun.exitReason', errors)
  validateIsoDateTime(value.ranAt, 'lastRun.ranAt', errors)
}

function validateTaskGraph(tasks: ProgressTaskRecord[], errors: string[]) {
  const taskMap = new Map<string, ProgressTaskRecord>(
    tasks.filter(hasTaskId).map((task) => [task.id, task]),
  )

  for (const task of tasks) {
    const dependsOn = Array.isArray(task.dependsOn) ? task.dependsOn : []
    for (const depId of dependsOn) {
      if (!taskMap.has(depId)) {
        errors.push(`task ${task.id} 的 dependsOn 引用了不存在的 task: ${depId}`)
      }

      if (depId === task.id) {
        errors.push(`task ${task.id} 不允许依赖自己`)
      }
    }
  }

  const visited = new Set()
  const visiting = new Set()

  function dfs(taskId: string) {
    if (visiting.has(taskId)) {
      errors.push(`tasks 依赖图存在循环: ${taskId}`)
      return
    }
    if (visited.has(taskId) || !taskMap.has(taskId)) {
      return
    }

    visiting.add(taskId)
    const dependsOn = taskMap.get(taskId)?.dependsOn
    if (Array.isArray(dependsOn)) {
      for (const depId of dependsOn) {
        if (typeof depId === 'string') {
          dfs(depId)
        }
      }
    }
    visiting.delete(taskId)
    visited.add(taskId)
  }

  for (const task of tasks) {
    if (typeof task.id === 'string') {
      dfs(task.id)
    }
  }
}

function validateTaskStateConsistency(tasks: ProgressTaskRecord[], errors: string[]) {
  for (const task of tasks) {
    if (task.status === 'pending') {
      if (task.startedAt !== null) {
        errors.push(`task ${task.id} 为 pending 时 startedAt 必须为 null`)
      }
      if (task.completedAt !== null) {
        errors.push(`task ${task.id} 为 pending 时 completedAt 必须为 null`)
      }
      if (task.durationSeconds !== null) {
        errors.push(`task ${task.id} 为 pending 时 durationSeconds 必须为 null`)
      }
      continue
    }

    if (task.status === 'in-progress') {
      if (task.startedAt === null) {
        errors.push(`task ${task.id} 为 in-progress 时 startedAt 不能为空`)
      }
      if (task.completedAt !== null) {
        errors.push(`task ${task.id} 为 in-progress 时 completedAt 必须为 null`)
      }
      if (task.durationSeconds !== null) {
        errors.push(`task ${task.id} 为 in-progress 时 durationSeconds 必须为 null`)
      }
      continue
    }

    if (task.status === 'done') {
      if (task.startedAt === null) {
        errors.push(`task ${task.id} 为 done 时 startedAt 不能为空`)
      }
      if (task.completedAt === null) {
        errors.push(`task ${task.id} 为 done 时 completedAt 不能为空`)
      }
      if (task.durationSeconds === null) {
        errors.push(`task ${task.id} 为 done 时 durationSeconds 不能为空`)
      }
    }
  }
}

function validateLastRunConsistency(lastRun: ProgressLastRunRecord | null, tasks: ProgressTaskRecord[], errors: string[]) {
  if (lastRun == null) {
    return
  }

  const task = tasks.find((item) => item.id === lastRun.taskId)
  if (!task) {
    errors.push(`lastRun.taskId 未匹配到 task: ${lastRun.taskId}`)
    return
  }

  if (task.name !== lastRun.taskName) {
    errors.push(`lastRun.taskName 与 task ${task.id} 的 name 不一致`)
  }

  if (task.status !== lastRun.status) {
    errors.push(`lastRun.status 与 task ${task.id} 的 status 不一致`)
  }

  if (lastRun.exitStatus === 'succeeded' && task.status !== 'done') {
    errors.push(`lastRun.exitStatus 为 succeeded 时，task ${task.id} 的 status 必须为 done`)
  }

  if (lastRun.exitStatus !== 'succeeded' && task.status !== 'in-progress') {
    errors.push(`lastRun.exitStatus 为 ${lastRun.exitStatus} 时，task ${task.id} 的 status 必须为 in-progress`)
  }

  if (typeof task.startedAt === 'string' && typeof lastRun.ranAt === 'string' && Date.parse(lastRun.ranAt) < Date.parse(task.startedAt)) {
    errors.push(`lastRun.ranAt 不能早于 task ${task.id} 的 startedAt`)
  }

  if (typeof task.completedAt === 'string' && typeof lastRun.ranAt === 'string' && Date.parse(lastRun.ranAt) < Date.parse(task.completedAt)) {
    errors.push(`lastRun.ranAt 不能早于 task ${task.id} 的 completedAt`)
  }
}

function validateFeatureCompletion(completedAt: unknown, tasks: ProgressTaskRecord[], errors: string[]) {
  const allDone = tasks.every((task) => task.status === 'done')

  if (allDone && completedAt === null) {
    errors.push('所有 task 已完成时 completedAt 不能为空')
  }

  if (!allDone && completedAt !== null) {
    errors.push('存在未完成 task 时 completedAt 必须为 null')
  }
}

function validateExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[], label: string, errors: string[]) {
  const actualKeys = Object.keys(value)
  const missing = expectedKeys.filter((key) => !actualKeys.includes(key))
  const extra = actualKeys.filter((key) => !expectedKeys.includes(key))

  if (missing.length > 0) {
    errors.push(`${label} 缺少字段: ${missing.join(', ')}`)
  }

  if (extra.length > 0) {
    errors.push(`${label} 存在未定义字段: ${extra.join(', ')}`)
  }
}

function validateNonEmptyString(value: unknown, label: string, errors: string[]) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${label} 必须是非空 string`)
  }
}

function validateTaskStatus(value: unknown, label: string, errors: string[]) {
  if (typeof value !== 'string' || !(TASK_STATUSES as readonly string[]).includes(value)) {
    errors.push(`${label} 必须是 ${TASK_STATUSES.join(' | ')}`)
  }
}

function validateLastRunStatus(value: unknown, label: string, errors: string[]) {
  const allowedStatuses: readonly string[] = TASK_STATUSES.filter((status) => status !== 'pending')

  if (typeof value !== 'string' || !allowedStatuses.includes(value)) {
    errors.push(`${label} 必须是 ${allowedStatuses.join(' | ')}`)
  }
}

function validateRunExitStatus(value: unknown, label: string, errors: string[]) {
  if (typeof value !== 'string' || !(RUN_EXIT_STATUSES as readonly string[]).includes(value)) {
    errors.push(`${label} 必须是 ${RUN_EXIT_STATUSES.join(' | ')}`)
  }
}

function validateExitReason(value: unknown, exitStatus: unknown, label: string, errors: string[]) {
  if (typeof value !== 'string') {
    errors.push(`${label} 必须是 string`)
    return
  }

  if (exitStatus && exitStatus !== 'succeeded' && value.trim() === '') {
    errors.push(`${label} 在 exitStatus 非 succeeded 时必须为非空 string`)
  }
}

function validateDependsOn(value: unknown, label: string, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${label} 必须是 string[]`)
    return
  }

  for (const depId of value) {
    if (typeof depId !== 'string' || depId.trim() === '') {
      errors.push(`${label} 只能包含非空 string`)
    }
  }
}

function validateIsoDateTime(value: unknown, label: string, errors: string[]) {
  if (typeof value !== 'string' || !ISO_DATE_TIME_RE.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push(`${label} 必须是合法的 ISO 8601 时间字符串`)
  }
}

function validateNullableIsoDateTime(value: unknown, label: string, errors: string[]) {
  if (value === null) {
    return
  }

  validateIsoDateTime(value, label, errors)
}

function validateNullableDuration(value: unknown, label: string, errors: string[]) {
  if (value === null) {
    return
  }

  if (!Number.isInteger(value) || (value as number) < 0) {
    errors.push(`${label} 必须是非负整数或 null`)
  }
}

function validateOutput(value: unknown, status: unknown, label: string, errors: string[]) {
  if (typeof value !== 'string') {
    errors.push(`${label}.output 必须是 string`)
    return
  }

  if (status === 'pending' || status === 'in-progress') {
    if (value !== '') {
      errors.push(`${label}.output 在 status 为 ${status} 时必须为空字符串`)
    }
    return
  }

  if (status === 'done') {
    if (value.trim() === '') {
      errors.push(`${label}.output 在 status 为 done 时不能为空`)
    } else if (value.length > 200) {
      errors.push(`${label}.output 超过最大长度 200 字符（当前 ${value.length} 字符）`)
    }
    if (/[\n\r]/.test(value)) {
      errors.push(`${label}.output 不能包含换行符`)
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
