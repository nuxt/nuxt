import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { H3, HTTPError } from 'nitro/h3'
import type { H3Event } from 'nitro/h3'
import { routeRules } from 'h3/rules'
import { cache } from 'h3/rules/cache'

const serverFetch = vi.hoisted(() => vi.fn())
const observeDevError = vi.hoisted(() => vi.fn())
const flags = vi.hoisted(() => ({ inlineErrors: false, legacyCompat: false, legacyResponseHeaders: false, nuxt4Host: false }))

vi.mock('nitro', () => ({ serverFetch }))
vi.mock('../src/runtime/utils/error-channel', () => ({
  observeDevError,
  serializeErrorCause: () => undefined,
}))
vi.mock('nuxt/internal/renderer-config', async importOriginal => ({
  ...await importOriginal<typeof import('nuxt/internal/renderer-config')>(),
  get NUXT_INLINE_ERROR_RENDERING () {
    return flags.inlineErrors
  },
}))
vi.mock('#nuxt-compat/flags', () => ({
  get legacyCompat () {
    return flags.legacyCompat
  },
  get legacyResponseHeaders () {
    return flags.legacyResponseHeaders
  },
}))
vi.mock('#internal/nuxt/host', async (importOriginal) => {
  const host = await importOriginal<typeof import('#internal/nuxt/host')>()
  const nuxt4 = await import('../src/runtime/host/nuxt4.ts')
  return {
    ...host,
    toJSONErrorBody: <T>(body: T) => (flags.nuxt4Host ? nuxt4 : host).toJSONErrorBody(body),
  }
})

const { docsVersion } = await import('#internal/nuxt/host')

const { default: errorHandler } = await import('../src/runtime/handlers/error.ts')
const { keepArrivalRequest } = await import('../src/runtime/utils/arrival-request.ts')

function event (path: string, accept: string, headers?: HeadersInit, ruleHeaders?: Record<string, string>) {
  return {
    url: new URL(`http://localhost${path}`),
    req: { url: `http://localhost${path}`, method: 'GET', headers: new Headers({ accept }) },
    res: { headers: new Headers(headers) },
    context: ruleHeaders ? { routeRules: { headers: ruleHeaders } } : {},
  } as unknown as H3Event
}

function handle (error: Error, accept: string, defaults: { status?: number, statusText?: string, body?: unknown, headers?: HeadersInit } = {}, path = '/unknown', responseHeaders?: HeadersInit, ruleHeaders?: Record<string, string>) {
  return errorHandler(error as any, event(path, accept, responseHeaders, ruleHeaders), {
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
  flags.legacyCompat = false
  flags.legacyResponseHeaders = false
  flags.nuxt4Host = false
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

describe('error handler cache-control', () => {
  const immutable = { 'cache-control': 'public, max-age=31536000, immutable' }

  it.each(['application/json', 'text/html'])('does not keep the cache-control of a route rule on a %s error', async (accept) => {
    serverFetch.mockResolvedValue(new Response('<html></html>', { headers: immutable }))
    const res = await handle(new HTTPError({ status: 404 }), accept, { headers: immutable }, '/_nuxt/missing.js', immutable)

    expect(res.headers.get('cache-control')).toBe('no-cache')
  })

  it('does not keep the cache-control of a route rule on the static error page', async () => {
    serverFetch.mockRejectedValue(new Error('render failed'))
    const res = await handle(new HTTPError({ status: 404 }), 'text/html', {}, '/missing', immutable)

    expect(res.headers.get('content-type')).toBe('text/html;charset=UTF-8')
    expect(res.headers.get('cache-control')).toBe('no-cache')
  })

  it('does not keep the cache-control of a route rule on the development error report', async () => {
    vi.stubGlobal('__TEST_DEV__', true)
    serverFetch.mockRejectedValue(new Error('render failed'))
    observeDevError.mockResolvedValue({ page: () => Promise.resolve('<html>report</html>') })
    const res = await handle(new Error('boom'), 'text/html', { status: 500, body: {} }, '/boom', immutable)

    expect(await res.text()).toBe('<html>report</html>')
    expect(res.headers.get('cache-control')).toBe('no-cache')
  })

  it.each(['application/json', 'text/html'])('keeps the cache-control set on a %s error', async (accept) => {
    const res = await handle(new HTTPError({ status: 404, headers: { 'cache-control': 'no-store' } }), accept, { headers: { 'cache-control': 'no-store' } }, '/_nuxt/missing.js', immutable)

    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it.each(['application/json', 'text/html'])('keeps a cache-control set before a %s error that rules out shared caching', async (accept) => {
    const res = await handle(new HTTPError({ status: 401 }), accept, {}, '/api/me', { 'cache-control': 'no-store' })

    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('keeps a cache-control the error page sets that rules out shared caching', async () => {
    serverFetch.mockResolvedValue(new Response('<html></html>', { headers: { 'cache-control': 'private, no-store' } }))
    const res = await handle(new HTTPError({ status: 404 }), 'text/html')

    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  async function underRule (cacheControl: string, accept: string, error = new HTTPError({ status: 401 })) {
    const rule = { 'Cache-Control': cacheControl }
    serverFetch.mockResolvedValue(new Response('<html></html>', { headers: rule }))
    const res = await handle(error, accept, { headers: rule }, '/api/internal/me', rule, rule)
    return res.headers.get('cache-control')
  }

  describe.each(['application/json', 'text/html'])('on a %s error', (accept) => {
    it.each(['no-store', 'private, max-age=60', 'no-cache', 'public, no-cache', 'max-age=0, must-revalidate', 'max-age=0, proxy-revalidate', 'public, s-maxage=0', 'no-store, must-understand, private', 'no-store,,', ',no-store', 'no-store, ,private', 'no-store, no-cache="set-cookie,authorization"'])('keeps the route rule cache-control %s', async (cacheControl) => {
      expect(await underRule(cacheControl, accept)).toBe(cacheControl)
    })

    it.each(['public, max-age=60', 'max-age=0', 'max-age=0, s-maxage=60, must-revalidate', 'no-cache, stale-if-error=60', 's-maxage=0, stale-while-revalidate=60', 'no-cache="set-cookie", max-age=60', 'private="set-cookie", max-age=60', 'private="set-cookie,,authorization", max-age=60', 'no-store, must-understand, public, max-age=60', 'no-store,, must-understand', 'no-store private', 'no-store, =private', 'no-store, "private"', ',,'])('replaces the route rule cache-control %s', async (cacheControl) => {
      expect(await underRule(cacheControl, accept)).toBe('no-cache')
    })

    it('keeps the cache-control set on the error over the route rule', async () => {
      expect(await underRule('no-store', accept, new HTTPError({ status: 401, headers: { 'cache-control': 'private, max-age=5' } }))).toBe('private, max-age=5')
    })
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

describe('JSON error body', () => {
  const body = { error: true, status: 404, statusText: 'Not Found', message: 'Not Found' }

  it('carries the h3 v1 status keys with the legacy layer on a Nuxt 4 host', async () => {
    flags.legacyCompat = true
    flags.nuxt4Host = true
    const res = await handle(new HTTPError({ status: 404, statusText: 'Not Found' }), 'application/json', { body })

    expect(await res.json()).toEqual({ ...body, statusCode: 404, statusMessage: 'Not Found' })
  })

  it('carries the h3 v1 status keys with the legacy layer only on a Nuxt 4 host', async () => {
    flags.legacyCompat = true
    const res = await handle(new HTTPError({ status: 404, statusText: 'Not Found' }), 'application/json', { body })

    expect(await res.json()).toEqual(docsVersion === '4.x'
      ? { ...body, statusCode: 404, statusMessage: 'Not Found' }
      : body)
  })

  const securityHeaders = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'content-security-policy': 'script-src \'none\'; frame-ancestors \'none\';',
  }

  it('is sent with the Nitro v2 security headers with the legacy response headers on', async () => {
    flags.legacyResponseHeaders = true
    const res = await handle(new HTTPError({ status: 404 }), 'application/json', {}, '/api/missing', { 'x-frame-options': 'SAMEORIGIN' })

    expect(Object.fromEntries(res.headers)).toMatchObject(securityHeaders)
  })

  it('is sent without the Nitro v2 security headers otherwise', async () => {
    flags.nuxt4Host = true
    const res = await handle(new HTTPError({ status: 404 }), 'application/json')

    for (const name in securityHeaders) {
      expect(res.headers.has(name)).toBe(false)
    }
  })

  it('is the Nitro body without the legacy layer', async () => {
    flags.nuxt4Host = true
    const res = await handle(new HTTPError({ status: 404, statusText: 'Not Found' }), 'application/json', { body })

    expect(await res.json()).toEqual(body)
  })
})

describe('HTML error page', () => {
  const securityHeaders = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
  }

  it('is sent with the Nitro v2 security headers, without their CSP, with the legacy response headers on', async () => {
    flags.legacyResponseHeaders = true
    const rendered = await handle(new HTTPError({ status: 404 }), 'text/html')
    expect(Object.fromEntries(rendered.headers)).toMatchObject(securityHeaders)
    expect(rendered.headers.has('content-security-policy')).toBe(false)

    serverFetch.mockRejectedValue(new Error('render failed'))
    const fallback = await handle(new HTTPError({ status: 404 }), 'text/html')
    expect(Object.fromEntries(fallback.headers)).toMatchObject(securityHeaders)
    expect(fallback.headers.has('content-security-policy')).toBe(false)
  })

  it('lets the rendered error page set its own security headers', async () => {
    flags.legacyResponseHeaders = true
    serverFetch.mockResolvedValue(new Response('<html></html>', { headers: { 'x-frame-options': 'SAMEORIGIN' } }))
    const res = await handle(new HTTPError({ status: 404 }), 'text/html')

    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
  })

  it('is sent without the Nitro v2 security headers otherwise', async () => {
    flags.nuxt4Host = true
    const res = await handle(new HTTPError({ status: 404 }), 'text/html')

    for (const name in securityHeaders) {
      expect(res.headers.has(name)).toBe(false)
    }
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

describe('error handler in a cached route', () => {
  async function fetchError (path: string, headers: Record<string, string>, keep: boolean) {
    const app = new H3({
      silent: true,
      onRequest: keep ? keepArrivalRequest : undefined,
      onError: (error, event) => errorHandler(error, event, {
        defaultHandler: () => ({ status: 500, statusText: 'Server Error', body: { status: 500, statusText: 'Server Error' }, headers: new Headers({ 'content-type': 'application/json' }) }),
      } as any),
    })
    app.use(routeRules({ '/cached/**': { swr: 60 }, '/api/cached/**': { swr: 60 } }, { handlers: { cache } }))
    app.get('/cached/boom', () => { throw new Error('boom') })
    app.get('/api/cached/boom', () => { throw new Error('boom') })
    const res = await app.fetch(new Request(`http://localhost${path}`, { headers }))
    return { json: res.headers.get('content-type')?.includes('application/json') ?? false, rendered: serverFetch.mock.calls.length > 0 }
  }

  it.each([
    ['/cached/boom', { accept: 'application/json' }, true],
    ['/cached/boom', { 'user-agent': 'curl/8.0' }, true],
    ['/api/cached/boom', { accept: 'text/html' }, false],
  ])('follows the headers %s arrived with %o when the arrival request is kept', async (path, headers, json) => {
    expect(await fetchError(path, headers, true)).toEqual({ json, rendered: !json })
  })

  it('reads the request the cache rule hands the route otherwise', async () => {
    expect(await fetchError('/cached/boom', { accept: 'application/json' }, false)).toEqual({ json: false, rendered: true })
  })
})
