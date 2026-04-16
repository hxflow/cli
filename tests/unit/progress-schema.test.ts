import { describe, expect, it } from 'bun:test'
import { PROGRESS_LAST_RUN_KEYS, PROGRESS_SCHEMA, PROGRESS_TASK_KEYS, PROGRESS_TOP_LEVEL_KEYS } from '../../hxflow/scripts/lib/progress-schema.ts'

describe('progress schema', () => {
  it('locks progress.json to a fixed top-level schema', () => {
    const schema = PROGRESS_SCHEMA

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(schema.type).toBe('object')
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual([
      'feature',
      'requirementDoc',
      'planDoc',
      'createdAt',
      'updatedAt',
      'completedAt',
      'lastRun',
      'tasks',
    ])
  })

  it('locks lastRun to null or a fixed 6-field object', () => {
    const schema = PROGRESS_SCHEMA
    const variants = schema.properties.lastRun.anyOf
    const objectVariant = variants.find((item) => item.type === 'object')

    expect(variants).toHaveLength(2)
    expect(variants.some((item) => item.type === 'null')).toBe(true)
    expect(objectVariant!.additionalProperties).toBe(false)
    expect(objectVariant!.required).toEqual(PROGRESS_LAST_RUN_KEYS)
    expect(objectVariant!.properties.status.enum).toEqual(['in-progress', 'done'])
    expect(objectVariant!.properties.exitStatus.enum).toEqual(['succeeded', 'failed', 'aborted', 'blocked', 'timeout'])
  })

  it('locks each task item to the fixed 9-field schema', () => {
    const schema = PROGRESS_SCHEMA
    const taskSchema = schema.properties.tasks.items

    expect(schema.properties.tasks.minItems).toBe(1)
    expect(taskSchema.type).toBe('object')
    expect(taskSchema.additionalProperties).toBe(false)
    expect(taskSchema.required).toEqual([
      'id',
      'name',
      'status',
      'dependsOn',
      'parallelizable',
      'output',
      'startedAt',
      'completedAt',
      'durationSeconds',
    ])
    expect(taskSchema.properties.status.enum).toEqual(['pending', 'in-progress', 'done'])
    expect(taskSchema.properties.parallelizable.type).toBe('boolean')
    expect(taskSchema.properties.durationSeconds.minimum).toBe(0)
  })

  it('keeps exported TS field sets aligned with the schema object', () => {
    expect(PROGRESS_TOP_LEVEL_KEYS).toEqual(PROGRESS_SCHEMA.required)
    expect(PROGRESS_LAST_RUN_KEYS).toEqual(PROGRESS_SCHEMA.properties.lastRun.anyOf[1].required)
    expect(PROGRESS_TASK_KEYS).toEqual(PROGRESS_SCHEMA.properties.tasks.items.required)
  })
})
