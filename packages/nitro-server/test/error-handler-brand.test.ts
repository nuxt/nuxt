import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'

const observeDevError = vi.hoisted(() => vi.fn())

vi.mock('nitropack/runtime', () => ({
  useNitroApp: () => ({ localFetch: () => Promise.resolve(new Response('')) }),
  useRuntimeConfig: () => ({ app: { baseURL: '/' } }),
}))
vi.mock('#internal/nuxt/error-channel', () => ({
  observeDevError,
  serializeErrorCause: () => undefined,
}))

const { default: errorHandler } = await import('../src/runtime/handlers/error.ts')

class ForeignH3Error extends Error {
  static __h3_error__ = true
  statusCode: number
  constructor (statusCode: number) {
    super('foreign')
    this.statusCode = statusCode
  }
}

async function observedAs (error: Error) {
  const req = new IncomingMessage(new Socket())
  req.method = 'GET'
  req.url = '/unknown'
  req.headers = { host: 'localhost', accept: 'application/json' }
  const event = createEvent(req, new ServerResponse(req))
  await errorHandler(error as any, event, {
    defaultHandler: () => Promise.resolve({ status: 404, statusText: 'Not Found', body: {}, headers: {} }),
  } as any)
  return observeDevError.mock.lastCall?.[2]
}

describe('dev error handler', () => {
  beforeAll(() => {
    vi.stubGlobal('__TEST_DEV__', true)
  })
  afterAll(() => {
    vi.unstubAllGlobals()
  })
  beforeEach(() => {
    observeDevError.mockReset()
    observeDevError.mockResolvedValue(undefined)
  })

  it('treats a client error from another copy of h3 as expected', async () => {
    expect(await observedAs(new ForeignH3Error(404))).toMatchObject({ expected: true, print: false })
  })

  it('does not treat a server error from another copy of h3 as expected', async () => {
    expect(await observedAs(new ForeignH3Error(500))).toMatchObject({ expected: false })
  })
})
