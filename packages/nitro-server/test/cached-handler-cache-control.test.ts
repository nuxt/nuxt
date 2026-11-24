import { describe, expect, it, vi } from 'vitest'
import { H3 } from 'nitro/h3'

vi.mock('#nuxt-compat/flags', () => ({ legacyResponseHeaders: true }))

const { defineCachedEventHandler } = await import('../src/runtime/compat/cache.ts')

function serve (handler: (...args: any[]) => any, options: Record<string, any>) {
  const app = new H3()
  app.get('/**', defineCachedEventHandler(handler, options) as any)
  return (path: string, headers?: HeadersInit) => app.fetch(new Request(`http://localhost${path}`, { headers }))
}

const delayed = <T> (value: () => T) => new Promise<T>(resolve => setTimeout(() => resolve(value()), 20))

describe('the cache-control of a nitro v2 cached handler', () => {
  it.each(['no-store', 'private', 'no-cache'])('is the handler\'s own `%s` for every request served from one result', async (cacheControl) => {
    const fetch = serve(() => delayed(() => new Response('body', { headers: { 'cache-control': cacheControl } })), { maxAge: 60 })

    const responses = await Promise.all([fetch('/own'), fetch('/own')])

    expect(responses.map(response => response.headers.get('cache-control'))).toEqual([cacheControl, cacheControl])
  })

  it.each(['no-store', 'private', 'no-cache'])('is the handler\'s own `%s` for a later request', async (cacheControl) => {
    const fetch = serve(() => new Response('body', { headers: { 'cache-control': cacheControl } }), { maxAge: 60 })

    const responses = [await fetch('/later'), await fetch('/later')]

    expect(responses.map(response => response.headers.get('cache-control'))).toEqual([cacheControl, cacheControl])
  })

  it('is the handler\'s own value, or `public`, when the options set none', async () => {
    const own = serve(() => new Response('body', { headers: { 'cache-control': 'max-age=7' } }), { name: 'own' })
    const none = serve(() => 'body', { name: 'none' })
    const unshared = serve(() => new Response('body', { headers: { 'cache-control': 'no-store' } }), { name: 'unshared' })

    const responses = [await own('/own'), await own('/own'), await none('/none'), await none('/none'), await unshared('/unshared')]

    expect(responses.map(response => response.headers.get('cache-control'))).toEqual(['max-age=7', 'max-age=7', 'public', 'public', 'no-store'])
  })

  it.each([{ maxAge: 3600 }, { name: 'unset' }])('is the handler\'s own for a response with a status that is not cached (%o)', async (options) => {
    const unavailable = serve(() => new Response('unavailable', { status: 503 }), options)
    const notFound = serve(() => new Response('missing', { status: 404, headers: { 'cache-control': 'max-age=5' } }), options)

    const responses = [await unavailable('/unavailable'), await notFound('/not-found')]

    expect(responses.map(response => [response.status, response.headers.get('cache-control')])).toEqual([[503, null], [404, 'max-age=5']])
  })

  it('is the Nitro v2 value for every request served from a result, including a revalidation', async () => {
    const fetch = serve(() => delayed(() => new Response('body', { headers: { 'cache-control': 'max-age=5' } })), { maxAge: 60 })

    const shared = await Promise.all([fetch('/public'), fetch('/public')])
    const hit = await fetch('/public')
    const revalidated = await fetch('/public', { 'if-none-match': hit.headers.get('etag')! })

    expect(revalidated.status).toBe(304)
    expect([...shared, hit, revalidated].map(response => response.headers.get('cache-control'))).toEqual(['max-age=60', 'max-age=60', 'max-age=60', 'max-age=60'])
  })
})
