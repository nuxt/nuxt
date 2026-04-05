import { describe, expect, it } from 'vitest'

import { deserializeIPCError, serializeIPCError } from './ipc-error.ts'

describe('ipc error serialization', () => {
  it('preserves message, stack and common metadata', () => {
    const original = new Error('top-level failure', {
      cause: new Error('root cause failure'),
    }) as Error & {
      code?: string
      status?: number
      statusText?: string
      data?: unknown
      plugin?: string
      id?: string
      loc?: { file: string, line: number, column: number }
      frame?: string
    }

    original.name = 'TransformError'
    original.code = 'PARSE_ERROR'
    original.status = 500
    original.statusText = 'Internal Error'
    original.data = { foo: 'bar' }
    original.plugin = 'vite:import-analysis'
    original.id = '/app/main.ts'
    original.loc = { file: '/app/main.ts', line: 10, column: 7 }
    original.frame = '8 | import x from "missing"'
    original.stack = 'STACK: top-level failure'

    const serialized = serializeIPCError(original)
    const hydrated = deserializeIPCError(serialized)

    expect(hydrated.message).toBe('top-level failure')
    expect(hydrated.name).toBe('TransformError')
    expect(hydrated.code).toBe('PARSE_ERROR')
    expect(hydrated.status).toBe(500)
    expect(hydrated.statusText).toBe('Internal Error')
    expect(hydrated.data).toEqual({ foo: 'bar' })
    expect(hydrated.plugin).toBe('vite:import-analysis')
    expect(hydrated.id).toBe('/app/main.ts')
    expect(hydrated.loc).toEqual({ file: '/app/main.ts', line: 10, column: 7 })
    expect(hydrated.frame).toBe('8 | import x from "missing"')
    expect(hydrated.stack).toContain('STACK: top-level failure')
    expect(hydrated.cause).toBeInstanceOf(Error)
    expect((hydrated.cause as Error).message).toBe('root cause failure')
  })

  it('does not throw with non-serializable payloads', () => {
    const circular: { self?: unknown } = {}
    circular.self = circular

    const err = new Error('circular data') as Error & { data?: unknown }
    err.data = circular

    const serialized = serializeIPCError(err)

    expect(serialized.message).toBe('circular data')
    expect(() => deserializeIPCError(serialized)).not.toThrow()
  })
})
