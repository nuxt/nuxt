import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HTTPError } from 'nitro/h3'
import type { H3Event } from 'nitro/h3'

const serverFetch = vi.hoisted(() => vi.fn())

vi.mock('nitro', () => ({ serverFetch }))

const { default: errorHandler } = await import('../src/runtime/handlers/error.ts')

function event (accept: string) {
  const headers = new Headers({ accept })
  return {
    url: new URL('http://localhost/unknown'),
    req: { url: 'http://localhost/unknown', method: 'GET', headers },
    res: { headers: new Headers() },
    context: {},
  } as unknown as H3Event
}

function handle (error: HTTPError, accept: string, defaultHeaders?: HeadersInit) {
  return errorHandler(error as any, event(accept), {
    defaultHandler: () => Promise.resolve({
      status: 404,
      statusText: 'Page not found',
      body: { statusCode: 404 },
      headers: new Headers(defaultHeaders),
    }),
  } as any) as Promise<Response>
}

describe('error handler vary', () => {
  beforeEach(() => {
    serverFetch.mockReset()
    serverFetch.mockResolvedValue(new Response('<html></html>', { headers: new Headers() }))
  })

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
    const res = await handle(new HTTPError({ status: 404 }), 'application/json', { vary: 'accept-encoding' })

    expect(res.headers.get('vary')).toBe('accept, sec-fetch-mode, accept-encoding')
  })

  it('lets a wildcard vary absorb accept', async () => {
    const res = await handle(new HTTPError({ status: 404, headers: { vary: '*' } }), 'text/html')

    expect(res.headers.get('vary')).toBe('*')
  })

  it('preserves the cache-control advertised on an early 404', async () => {
    const res = await handle(new HTTPError({ status: 404, headers: { 'cache-control': 'public, max-age=60' } }), 'application/json')

    expect(res.headers.get('cache-control')).toBe('public, max-age=60')
    expect(res.headers.get('vary')).toBe('accept, sec-fetch-mode')
  })
})
