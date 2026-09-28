import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'nitro/h3'

const serverFetch = vi.hoisted(() => vi.fn())
const observeDevError = vi.hoisted(() => vi.fn())

vi.mock('nitro', () => ({ serverFetch }))
vi.mock('../src/runtime/utils/error-channel', () => ({
  observeDevError,
  serializeErrorCause: () => undefined,
}))

const { default: errorHandler } = await import('../src/runtime/handlers/error.ts')

class ForeignHTTPError extends Error {
  override name = 'HTTPError'
  status: number
  constructor (status: number) {
    super('foreign')
    this.status = status
  }
}

async function observedAs (error: Error) {
  const event = {
    url: new URL('http://localhost/unknown'),
    req: { url: 'http://localhost/unknown', method: 'GET', headers: new Headers({ accept: 'application/json' }) },
    res: { headers: new Headers() },
    context: {},
  } as unknown as H3Event
  await errorHandler(error as any, event, {
    defaultHandler: () => Promise.resolve({ status: 404, statusText: 'Not Found', body: {}, headers: new Headers() }),
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
    expect(await observedAs(new ForeignHTTPError(404))).toMatchObject({ expected: true, print: false })
  })

  it('does not treat a server error from another copy of h3 as expected', async () => {
    expect(await observedAs(new ForeignHTTPError(500))).toMatchObject({ expected: false })
  })
})
