import { describe, expect, it, vi } from 'vitest'

vi.mock('@nuxt/nitro-server/h3', () => {
  class HTTPError extends Error {
    status: number
    statusText?: string
    constructor (input: { status?: number, statusText?: string, message?: string }) {
      super(input.message)
      this.status = input.status ?? 500
      this.statusText = input.statusText
    }

    get statusCode () { return this.status }
    get statusMessage () { return this.statusText }
  }
  return { createError: (input: any) => new HTTPError(input) }
})

describe('createError', () => {
  it('keeps the status of an error whose `statusCode` is derived from `status`', async () => {
    const { createError } = await import('../src/app/error')
    const error = createError({ status: 404, statusText: 'Not Found' })

    expect(error.status).toBe(404)
    expect(error.statusText).toBe('Not Found')
  })
})
