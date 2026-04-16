import { describe, expect, it } from 'bun:test'

import { parseArgs } from '../../hxflow/scripts/lib/config-utils.ts'

describe('config-utils', () => {
  it('parses positional args and option variants', () => {
    expect(parseArgs([
      'setup',
      'extra',
      '--agent',
      'claude,codex',
      '--dry-run',
      '--mode=fast',
      '-h',
    ])).toEqual({
      positional: ['setup', 'extra'],
      options: {
        agent: 'claude,codex',
        'dry-run': true,
        mode: 'fast',
        help: true,
      },
    })
  })
})
