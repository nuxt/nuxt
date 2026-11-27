import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { serializeErrorCause } from '../src/runtime/server/dev-error/index'

describe('serializeErrorCause', () => {
  it('should serialize an error from another realm', () => {
    const cause = runInNewContext('new TypeError("x is not a function", { cause: new Error("inner") })')

    expect(serializeErrorCause(cause)).toMatchObject({
      name: 'TypeError',
      message: 'x is not a function',
      stack: expect.stringContaining('x is not a function'),
      cause: { name: 'Error', message: 'inner' },
    })
  })

  it('should stop at a cycle of error-like objects', () => {
    const a: Record<string, unknown> = { message: 'a' }
    a.cause = { message: 'b', cause: a }

    expect(serializeErrorCause(a)).toEqual({
      name: 'Error',
      message: 'a',
      cause: { name: 'Error', message: 'b' },
    })
  })
})
