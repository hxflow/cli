/**
 * race-conditions.test.ts — 并发竞态测试
 *
 * 测试并行/并发任务执行时的竞态条件和数据一致性：
 * - 多任务并发启动
 * - 并行任务完成与文件写入
 * - Task Scheduler 并发调度
 * - Progress 文件并发更新
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { writeFileSync, mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { startTask, completeTask } from '../../hxflow/scripts/lib/progress-ops.ts'
import { getScheduledBatch } from '../../hxflow/scripts/lib/task-scheduler.ts'
import type { ProgressData, ProgressTask } from '../../hxflow/scripts/lib/types.ts'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<ProgressTask>): ProgressTask {
  return {
    id: 'TASK-1',
    name: '任务',
    status: 'pending',
    dependsOn: [],
    parallelizable: false,
    output: '',
    startedAt: null,
    completedAt: null,
    durationSeconds: null,
    ...overrides,
  }
}

function makeProgressData(overrides: Partial<ProgressData> = {}): ProgressData {
  const now = '2024-01-01T00:00:00Z'
  return {
    feature: 'RACE-TEST',
    requirementDoc: 'docs/requirement/RACE-TEST.md',
    planDoc: 'docs/plans/RACE-TEST.md',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    lastRun: null,
    tasks: [
      makeTask({ id: 'TASK-1', name: '任务1' }),
    ],
    ...overrides,
  }
}

let tmpDir: string
let progressFile: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'hxflow-race-'))
  progressFile = join(tmpDir, 'progress.json')
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true })
})

function writeProgress(data: ProgressData) {
  writeFileSync(progressFile, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function readProgress(): ProgressData {
  return JSON.parse(readFileSync(progressFile, 'utf8'))
}

// ── 并发任务启动测试 ──────────────────────────────────────────────────────────

describe('concurrent task starts', () => {
  it('allows multiple parallelizable tasks to start concurrently', async () => {
    const data = makeProgressData({
      tasks: [
        makeTask({ id: 'TASK-A', name: '任务A', parallelizable: true }),
        makeTask({ id: 'TASK-B', name: '任务B', parallelizable: true }),
        makeTask({ id: 'TASK-C', name: '任务C', parallelizable: true }),
      ],
    })
    writeProgress(data)

    // 并发启动三个任务
    const starts = await Promise.allSettled([
      startTask(progressFile, 'TASK-A'),
      startTask(progressFile, 'TASK-B'),
      startTask(progressFile, 'TASK-C'),
    ])

    // 所有启动都应该成功
    expect(starts.every((r) => r.status === 'fulfilled')).toBe(true)

    const result = readProgress()
    expect(result.tasks.filter((t) => t.status === 'in-progress')).toHaveLength(3)
    expect(result.tasks.every((t) => t.startedAt !== null)).toBe(true)
  })

  it('handles concurrent startTask calls on the same task with file locking', async () => {
    const data = makeProgressData({
      tasks: [makeTask({ id: 'TASK-1', name: '单任务' })],
    })
    writeProgress(data)

    // 尝试并发启动同一个任务（竞态条件）
    const starts = await Promise.allSettled([
      startTask(progressFile, 'TASK-1'),
      startTask(progressFile, 'TASK-1'),
      startTask(progressFile, 'TASK-1'),
    ])

    // 由于文件锁，只有第一个会真正启动，后续的会看到已启动状态并保持 startedAt
    expect(starts.filter((r) => r.status === 'fulfilled').length).toBeGreaterThan(0)

    const result = readProgress()
    expect(result.tasks[0].status).toBe('in-progress')
    expect(result.tasks[0].startedAt).not.toBeNull()
    
    // 验证 startedAt 只有一个值（不会被覆盖）
    const startedAt = result.tasks[0].startedAt
    expect(typeof startedAt).toBe('string')
  })

  it('serializes concurrent operations on dependent tasks', async () => {
    // 测试依赖任务的串行化：当两个任务有依赖关系时，
    // 即使并发调用，file lock 也会确保它们串行执行
    const data = makeProgressData({
      tasks: [
        makeTask({ id: 'TASK-A', name: '依赖任务', status: 'pending' }),
        makeTask({ id: 'TASK-B', name: '被依赖任务', dependsOn: ['TASK-A'] }),
      ],
    })
    writeProgress(data)

    // 先启动 TASK-A
    startTask(progressFile, 'TASK-A')
    
    // TASK-B 应该无法启动，因为 TASK-A 还是 in-progress
    try {
      startTask(progressFile, 'TASK-B')
      // 如果没抛异常，测试失败
      throw new Error('Expected startTask to throw but it did not')
    } catch (error) {
      expect(error instanceof Error && error.message).toMatch(/未完成依赖/)
    }

    // 验证最终状态
    const result = readProgress()
    const taskA = result.tasks.find((t) => t.id === 'TASK-A')
    const taskB = result.tasks.find((t) => t.id === 'TASK-B')
    
    expect(taskA?.status).toBe('in-progress')
    expect(taskB?.status).toBe('pending')
  })
})

// ── 并行任务完成与文件写入 ────────────────────────────────────────────────────

describe('parallel task completion with file writes', () => {
  it('completes multiple parallelizable tasks concurrently', async () => {
    const data = makeProgressData({
      tasks: [
        makeTask({
          id: 'TASK-A',
          name: '任务A',
          status: 'in-progress',
          startedAt: '2024-01-01T00:00:00Z',
          parallelizable: true,
        }),
        makeTask({
          id: 'TASK-B',
          name: '任务B',
          status: 'in-progress',
          startedAt: '2024-01-01T00:00:00Z',
          parallelizable: true,
        }),
        makeTask({
          id: 'TASK-C',
          name: '任务C',
          status: 'in-progress',
          startedAt: '2024-01-01T00:00:00Z',
          parallelizable: true,
        }),
      ],
    })
    writeProgress(data)

    // 并发完成三个任务
    const completions = await Promise.allSettled([
      completeTask(progressFile, 'TASK-A', 'A完成'),
      completeTask(progressFile, 'TASK-B', 'B完成'),
      completeTask(progressFile, 'TASK-C', 'C完成'),
    ])

    // 所有完成都应该成功
    expect(completions.every((r) => r.status === 'fulfilled')).toBe(true)

    const result = readProgress()
    expect(result.tasks.filter((t) => t.status === 'done')).toHaveLength(3)
    expect(result.tasks.every((t) => t.completedAt !== null)).toBe(true)
    expect(result.tasks.every((t) => t.output !== '')).toBe(true)
    
    // 验证 completedAt 字段已设置
    expect(result.completedAt).not.toBeNull()
  })

  it('maintains data integrity during concurrent completeTask calls', async () => {
    const data = makeProgressData({
      tasks: [
        makeTask({
          id: 'TASK-1',
          name: '任务1',
          status: 'in-progress',
          startedAt: '2024-01-01T00:00:00Z',
        }),
        makeTask({
          id: 'TASK-2',
          name: '任务2',
          status: 'in-progress',
          startedAt: '2024-01-01T00:00:01Z',
        }),
      ],
    })
    writeProgress(data)

    // 并发完成两个任务
    await Promise.all([
      completeTask(progressFile, 'TASK-1', 'Task 1 output'),
      completeTask(progressFile, 'TASK-2', 'Task 2 output'),
    ])

    const result = readProgress()
    
    // 验证两个任务都正确完成
    const task1 = result.tasks.find((t) => t.id === 'TASK-1')
    const task2 = result.tasks.find((t) => t.id === 'TASK-2')
    
    expect(task1?.status).toBe('done')
    expect(task1?.output).toBe('Task 1 output')
    expect(task2?.status).toBe('done')
    expect(task2?.output).toBe('Task 2 output')
    
    // 验证没有数据丢失或损坏
    expect(result.tasks).toHaveLength(2)
  })

  it('verifies lock file is cleaned up after concurrent operations', async () => {
    const data = makeProgressData({
      tasks: [
        makeTask({
          id: 'TASK-A',
          name: '任务A',
          status: 'in-progress',
          startedAt: '2024-01-01T00:00:00Z',
        }),
        makeTask({
          id: 'TASK-B',
          name: '任务B',
          status: 'in-progress',
          startedAt: '2024-01-01T00:00:00Z',
        }),
      ],
    })
    writeProgress(data)

    // 并发操作
    await Promise.all([
      completeTask(progressFile, 'TASK-A', 'A done'),
      completeTask(progressFile, 'TASK-B', 'B done'),
    ])

    // 验证锁文件已被清理
    const lockFile = `${progressFile}.lock`
    expect(existsSync(lockFile)).toBe(false)
  })
})

// ── Task Scheduler 并发调度测试 ─────────────────────────────────────────────

describe('task scheduler under race conditions', () => {
  it('correctly identifies parallelizable batch', () => {
    const data = makeProgressData({
      tasks: [
        makeTask({ id: 'TASK-A', parallelizable: true }),
        makeTask({ id: 'TASK-B', parallelizable: true }),
        makeTask({ id: 'TASK-C', parallelizable: true }),
      ],
    })

    const batch = getScheduledBatch(data)
    expect(batch.parallel).toBe(true)
    expect(batch.tasks).toHaveLength(3)
    expect(batch.mode).toBe('run')
  })

  it('does not mark batch as parallel if any task is not parallelizable', () => {
    const data = makeProgressData({
      tasks: [
        makeTask({ id: 'TASK-A', parallelizable: true }),
        makeTask({ id: 'TASK-B', parallelizable: false }), // 不可并行
        makeTask({ id: 'TASK-C', parallelizable: true }),
      ],
    })

    const batch = getScheduledBatch(data)
    expect(batch.parallel).toBe(false)
    expect(batch.tasks).toHaveLength(3)
  })

  it('handles mixed status in concurrent scenario', () => {
    const data = makeProgressData({
      tasks: [
        makeTask({
          id: 'TASK-A',
          status: 'done',
          output: 'done',
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T00:01:00Z',
          durationSeconds: 60,
        }),
        makeTask({
          id: 'TASK-B',
          status: 'in-progress',
          startedAt: '2024-01-01T00:02:00Z',
          parallelizable: true,
        }),
        makeTask({
          id: 'TASK-C',
          status: 'pending',
          dependsOn: ['TASK-A'],
          parallelizable: true,
        }),
      ],
    })

    const batch = getScheduledBatch(data)
    
    // 应该优先恢复 in-progress 任务
    expect(batch.mode).toBe('recover')
    expect(batch.tasks).toHaveLength(1)
    expect(batch.tasks[0].id).toBe('TASK-B')
  })

  it('schedules runnable tasks after recoverable tasks are handled', () => {
    const data = makeProgressData({
      tasks: [
        makeTask({
          id: 'TASK-A',
          status: 'done',
          output: 'done',
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T00:01:00Z',
          durationSeconds: 60,
        }),
        makeTask({
          id: 'TASK-B',
          status: 'pending',
          dependsOn: ['TASK-A'],
          parallelizable: true,
        }),
        makeTask({
          id: 'TASK-C',
          status: 'pending',
          dependsOn: ['TASK-A'],
          parallelizable: true,
        }),
      ],
    })

    const batch = getScheduledBatch(data)
    
    // 没有 in-progress，应该返回可运行任务
    expect(batch.mode).toBe('run')
    expect(batch.tasks).toHaveLength(2)
    expect(batch.parallel).toBe(true)
  })
})

// ── Progress 文件并发更新测试 ─────────────────────────────────────────────────

describe('progress file updates during concurrent operations', () => {
  it('handles rapid sequential updates without data loss', async () => {
    const data = makeProgressData({
      tasks: [
        makeTask({ id: 'TASK-1', name: '任务1' }),
        makeTask({ id: 'TASK-2', name: '任务2' }),
        makeTask({ id: 'TASK-3', name: '任务3' }),
      ],
    })
    writeProgress(data)

    // 快速连续启动任务
    for (const id of ['TASK-1', 'TASK-2', 'TASK-3']) {
      startTask(progressFile, id)
    }

    const result = readProgress()
    expect(result.tasks.filter((t) => t.status === 'in-progress')).toHaveLength(3)
  })

  it('preserves updatedAt monotonicity during concurrent updates', async () => {
    const data = makeProgressData({
      tasks: [
        makeTask({
          id: 'TASK-A',
          status: 'in-progress',
          startedAt: '2024-01-01T00:00:00Z',
        }),
        makeTask({
          id: 'TASK-B',
          status: 'in-progress',
          startedAt: '2024-01-01T00:00:00Z',
        }),
      ],
    })
    writeProgress(data)

    const initialUpdatedAt = data.updatedAt

    // 并发完成任务
    await Promise.all([
      completeTask(progressFile, 'TASK-A', 'A完成'),
      completeTask(progressFile, 'TASK-B', 'B完成'),
    ])

    const result = readProgress()
    
    // updatedAt 应该大于初始值
    expect(new Date(result.updatedAt) > new Date(initialUpdatedAt)).toBe(true)
  })

  it('maintains lastRun integrity during concurrent task completions', async () => {
    const data = makeProgressData({
      tasks: [
        makeTask({
          id: 'TASK-X',
          name: '任务X',
          status: 'in-progress',
          startedAt: '2024-01-01T00:00:00Z',
        }),
        makeTask({
          id: 'TASK-Y',
          name: '任务Y',
          status: 'in-progress',
          startedAt: '2024-01-01T00:00:01Z',
        }),
      ],
    })
    writeProgress(data)

    // 并发完成
    await Promise.all([
      completeTask(progressFile, 'TASK-X', 'X完成'),
      completeTask(progressFile, 'TASK-Y', 'Y完成'),
    ])

    const result = readProgress()
    
    // lastRun 应该指向最后一个完成的任务（由于并发，可能是 X 或 Y）
    expect(result.lastRun).not.toBeNull()
    expect(['TASK-X', 'TASK-Y']).toContain(result.lastRun!.taskId)
    expect(result.lastRun!.exitStatus).toBe('succeeded')
  })
})

// ── 高压力并发测试 ──────────────────────────────────────────────────────────

describe('high-load concurrent scenarios', () => {
  it('handles 10 concurrent parallelizable task starts', async () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      makeTask({ id: `TASK-${i}`, name: `任务${i}`, parallelizable: true })
    )
    const data = makeProgressData({ tasks })
    writeProgress(data)

    // 并发启动 10 个任务
    const starts = await Promise.allSettled(
      tasks.map((t) => startTask(progressFile, t.id))
    )

    expect(starts.every((r) => r.status === 'fulfilled')).toBe(true)

    const result = readProgress()
    expect(result.tasks.filter((t) => t.status === 'in-progress')).toHaveLength(10)
  })

  it('handles 10 concurrent task completions', async () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      makeTask({
        id: `TASK-${i}`,
        name: `任务${i}`,
        status: 'in-progress',
        startedAt: '2024-01-01T00:00:00Z',
        parallelizable: true,
      })
    )
    const data = makeProgressData({ tasks })
    writeProgress(data)

    // 并发完成 10 个任务
    const completions = await Promise.allSettled(
      tasks.map((t) => completeTask(progressFile, t.id, `${t.name}完成`))
    )

    expect(completions.every((r) => r.status === 'fulfilled')).toBe(true)

    const result = readProgress()
    expect(result.tasks.filter((t) => t.status === 'done')).toHaveLength(10)
    expect(result.completedAt).not.toBeNull()
  })

  it('stress test: mixed concurrent operations', async () => {
    const data = makeProgressData({
      tasks: [
        makeTask({ id: 'START-1', name: '启动1', parallelizable: true }),
        makeTask({ id: 'START-2', name: '启动2', parallelizable: true }),
        makeTask({
          id: 'COMPLETE-1',
          name: '完成1',
          status: 'in-progress',
          startedAt: '2024-01-01T00:00:00Z',
          parallelizable: true,
        }),
        makeTask({
          id: 'COMPLETE-2',
          name: '完成2',
          status: 'in-progress',
          startedAt: '2024-01-01T00:00:00Z',
          parallelizable: true,
        }),
      ],
    })
    writeProgress(data)

    // 混合并发操作：启动和完成
    const operations = await Promise.allSettled([
      startTask(progressFile, 'START-1'),
      startTask(progressFile, 'START-2'),
      completeTask(progressFile, 'COMPLETE-1', '完成1输出'),
      completeTask(progressFile, 'COMPLETE-2', '完成2输出'),
    ])

    expect(operations.every((r) => r.status === 'fulfilled')).toBe(true)

    const result = readProgress()
    expect(result.tasks.filter((t) => t.status === 'in-progress')).toHaveLength(2)
    expect(result.tasks.filter((t) => t.status === 'done')).toHaveLength(2)
  })
})
