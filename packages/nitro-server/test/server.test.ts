import { describe, expect, it } from 'vitest'
import { resolve } from 'pathe'
import { resolveModuleExportNames } from '@nuxt/kit/internal'
import { H3Event } from 'nitro/h3'
import * as h3 from 'nitro/h3'
import * as shipped from 'nuxt/server'
import type { RequestEvent } from 'nuxt/server'

const delegatePath = resolve(import.meta.dirname, '../src/runtime/server.ts')

describe('the h3-backed `nuxt/server` implementations', () => {
  it('exports every name the portable surface does', async () => {
    const [surface, delegate] = await Promise.all([
      resolveModuleExportNames('nuxt/server', { url: import.meta.url }),
      resolveModuleExportNames(delegatePath, { url: import.meta.url }),
    ])

    expect(surface.length).toBeGreaterThan(0)
    expect(surface.filter(name => !delegate.includes(name))).toEqual([])
  })
})

/**
 * The shipped implementations and h3's have to agree, or a handler behaves differently
 * depending on which server builder the application configured.
 */
describe('parity between the shipped implementations and h3', () => {
  function events (request: Request) {
    const fallback = {
      req: request.clone(),
      url: new URL(request.url),
      res: { headers: new Headers() },
      context: {},
    } as unknown as RequestEvent

    return { fallback, h3: new H3Event(request) as unknown as RequestEvent }
  }

  async function compare<T> (request: Request, read: (api: typeof shipped, event: RequestEvent) => T | Promise<T>) {
    const { fallback, h3: h3Event } = events(request)
    const settle = async (run: () => T | Promise<T>) => {
      try {
        return { value: await run() }
      } catch (error) {
        return { error: { status: (error as { status?: number }).status } }
      }
    }
    return {
      shipped: await settle(() => read(shipped, fallback)),
      h3: await settle(() => read(h3 as unknown as typeof shipped, h3Event)),
    }
  }

  const post = (body: BodyInit, contentType?: string) => new Request('https://nuxt.com/api', {
    method: 'POST',
    body,
    headers: contentType ? { 'content-type': contentType } : undefined,
  })

  it.for([
    ['a JSON body', post(JSON.stringify({ name: 'nuxt' }), 'application/json')],
    ['a JSON body with charset', post(JSON.stringify({ name: 'nuxt' }), 'application/json; charset=utf-8')],
    ['a suffixed JSON media type', post(JSON.stringify({ ok: true }), 'application/problem+json; charset=utf-8')],
    ['a JSON body with no content type', post(JSON.stringify({ name: 'nuxt' }))],
    ['a URL-encoded body', post('name=nuxt&tag=a&tag=b', 'application/x-www-form-urlencoded')],
    ['an empty body', post('', 'application/json')],
    ['a body that is not JSON', post('not json', 'text/plain')],
  ] as const)('reads %s the same way', async ([, request]) => {
    const { shipped, h3 } = await compare(request, (api, event) => api.readBody(event))
    expect(shipped).toEqual(h3)
  })

  it.for([
    ['no query', 'https://nuxt.com/api'],
    ['one parameter', 'https://nuxt.com/api?name=nuxt'],
    ['a repeated parameter', 'https://nuxt.com/api?tag=a&tag=b'],
    ['an empty value', 'https://nuxt.com/api?name='],
  ] as const)('reads %s the same way', async ([, url]) => {
    const { shipped, h3 } = await compare(new Request(url), (api, event) => api.getQuery(event))
    expect(shipped).toEqual(h3)
  })

  it('reads cookies the same way', async () => {
    const request = new Request('https://nuxt.com/api', { headers: { cookie: 'a=1; b=2' } })
    const { shipped, h3 } = await compare(request, (api, event) => [api.getCookie(event, 'a'), api.getCookie(event, 'missing')])
    expect(shipped).toEqual(h3)
  })

  it.for([
    ['a cookie', (api: typeof shipped, event: RequestEvent) => api.setCookie(event, 'a', '1')],
    ['a cookie with options', (api: typeof shipped, event: RequestEvent) => api.setCookie(event, 'a', '1', { httpOnly: true, path: '/admin' })],
    ['an expired cookie', (api: typeof shipped, event: RequestEvent) => api.deleteCookie(event, 'a')],
    ['an expired cookie with a path', (api: typeof shipped, event: RequestEvent) => api.deleteCookie(event, 'a', { path: '/admin' })],
  ] as const)('writes %s the same way', ([, write]) => {
    const { fallback, h3: h3Event } = events(new Request('https://nuxt.com/api'))
    write(shipped, fallback)
    write(h3 as unknown as typeof shipped, h3Event)

    expect(fallback.res.headers.getSetCookie()).toEqual(h3Event.res.headers.getSetCookie())
  })

  it('reads the request URL the same way', async () => {
    const { shipped, h3 } = await compare(new Request('https://nuxt.com/api?a=1#hash'), (api, event) => api.getRequestURL(event).href)
    expect(shipped).toEqual(h3)
  })
})
