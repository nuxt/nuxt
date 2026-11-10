import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HTTPError } from 'nitro/h3'
import type { H3Event } from 'nitro/h3'

const serverFetch = vi.hoisted(() => vi.fn())
const observeDevError = vi.hoisted(() => vi.fn())
const flags = vi.hoisted(() => ({ inlineErrors: false }))

vi.mock('nitro', () => ({ serverFetch }))
vi.mock('../src/runtime/utils/error-channel', () => ({
  observeDevError,
  serializeErrorCause: () => undefined,
}))
vi.mock('nuxt/internal/renderer-config', () => ({
  get NUXT_INLINE_ERROR_RENDERING () {
    return flags.inlineErrors
  },
}))

const { default: errorHandler } = await import('../src/runtime/handlers/error.ts')

function event (path: string, accept: string) {
  return {
    url: new URL(`http://localhost${path}`),
    req: { url: `http://localhost${path}`, method: 'GET', headers: new Headers({ accept }) },
    res: { headers: new Headers() },
    context: {},
  } as unknown as H3Event
}

function handle (error: Error, accept: string, defaults: { status?: number, statusText?: string, body?: unknown, headers?: HeadersInit } = {}, path = '/unknown') {
  return errorHandler(error as any, event(path, accept), {
    defaultHandler: () => Promise.resolve({
      status: defaults.status ?? 404,
      statusText: defaults.statusText ?? 'Page not found',
      body: defaults.body ?? { statusCode: 404 },
      headers: new Headers(defaults.headers),
    }),
  } as any) as Promise<Response>
}

beforeEach(() => {
  flags.inlineErrors = false
  serverFetch.mockReset()
  serverFetch.mockResolvedValue(new Response('<html></html>', { headers: new Headers() }))
  observeDevError.mockReset()
  observeDevError.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('error handler vary', () => {
  it('varies on the negotiated headers for the JSON error body', async () => {
    const res = await handle(new HTTPError({ status: 404 }), 'application/json')

    expect(res.headers.get('vary')).toBe('accept, sec-fetch-mode')
  })

  it('varies on the negotiated headers for the server-rendered error page', async () => {
    const res = await handle(new HTTPError({ status: 404 }), 'text/html')

    expect(res.headers.get('vary')).toBe('accept, sec-fetch-mode')
  })

  it('keeps vary set on the error', async () => {
    const res = await handle(new HTTPError({ status: 404, headers: { vary: 'accept-encoding' } }), 'text/html')

    expect(res.headers.get('vary')).toBe('accept-encoding, accept, sec-fetch-mode')
  })

  it('does not duplicate tokens already listed on the error', async () => {
    const res = await handle(new HTTPError({ status: 404, headers: { vary: 'Accept, Accept-Language' } }), 'text/html')

    expect(res.headers.get('vary')).toBe('accept, accept-language, sec-fetch-mode')
  })

  it('merges vary from the rendered error page instead of replacing it', async () => {
    serverFetch.mockResolvedValue(new Response('<html></html>', { headers: { vary: 'accept-language' } }))
    const res = await handle(new HTTPError({ status: 404 }), 'text/html')

    expect(res.headers.get('vary')).toBe('accept, sec-fetch-mode, accept-language')
  })

  it('merges vary from the default handler on the JSON path', async () => {
    const res = await handle(new HTTPError({ status: 404 }), 'application/json', { headers: { vary: 'accept-encoding' } })

    expect(res.headers.get('vary')).toBe('accept, sec-fetch-mode, accept-encoding')
  })

  it('lets a wildcard vary absorb accept', async () => {
    const res = await handle(new HTTPError({ status: 404, headers: { vary: '*' } }), 'text/html')

    expect(res.headers.get('vary')).toBe('*')
  })

  it('sends each cookie once on the server-rendered error page', async () => {
    const res = await handle(new HTTPError({ status: 404, headers: { 'set-cookie': 'session=1' } }), 'text/html', { headers: { 'set-cookie': 'session=1' } })

    expect(res.headers.getSetCookie()).toEqual(['session=1'])
  })

  it('preserves the cache-control advertised on an early 404', async () => {
    const res = await handle(new HTTPError({ status: 404, headers: { 'cache-control': 'public, max-age=60' } }), 'application/json')

    expect(res.headers.get('cache-control')).toBe('public, max-age=60')
    expect(res.headers.get('vary')).toBe('accept, sec-fetch-mode')
  })
})

describe('error handler with inline error rendering', () => {
  it('returns JSON, even for a page request', async () => {
    flags.inlineErrors = true
    const res = await handle(new HTTPError({ status: 401 }), 'text/html', { status: 401, statusText: 'Unauthorized', body: { status: 401 } }, '/admin')

    expect(await res.json()).toEqual({ status: 401 })
    expect(res.headers.has('vary')).toBe(false)
    expect(serverFetch).not.toHaveBeenCalled()
  })
})

describe('dev error handler', () => {
  class ForeignHTTPError extends Error {
    override name = 'HTTPError'
    status: number
    constructor (status: number) {
      super('foreign')
      this.status = status
    }
  }

  async function observedAs (error: Error) {
    await handle(error, 'application/json')
    return observeDevError.mock.lastCall?.[2]
  }

  const overlay = vi.fn()

  async function renderHtmlError () {
    serverFetch.mockResolvedValue(new Response('<html>page</html>'))
    overlay.mockReset()
    overlay.mockResolvedValue('<html>overlay</html>')
    observeDevError.mockResolvedValue({ overlay, page: () => Promise.resolve('<html>report</html>') })
    const res = await handle(new Error('boom'), 'text/html', { status: 500, statusText: 'Server Error', body: {} }, '/boom')
    return { html: await res.text(), publish: observeDevError.mock.lastCall?.[2]?.publish }
  }

  beforeEach(() => {
    vi.stubGlobal('__TEST_DEV__', true)
  })

  it('treats a client error from another copy of h3 as expected', async () => {
    expect(await observedAs(new ForeignHTTPError(404))).toMatchObject({ expected: true, print: false })
  })

  it('does not treat a server error from another copy of h3 as expected', async () => {
    expect(await observedAs(new ForeignHTTPError(500))).toMatchObject({ expected: false })
  })

  it('publishes the report and overlays the page outside of tests', async () => {
    vi.stubGlobal('__TEST_TEST__', false)
    expect(await renderHtmlError()).toEqual({ html: '<html>overlay</html>', publish: true })
  })

  it('neither publishes the report nor overlays the page when `import.meta.test` is set', async () => {
    vi.stubGlobal('__TEST_TEST__', true)
    expect(await renderHtmlError()).toEqual({ html: '<html>page</html>', publish: false })
    expect(overlay).not.toHaveBeenCalled()
  })
})
