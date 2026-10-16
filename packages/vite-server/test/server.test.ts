import { describe, expect, it, vi } from 'vitest'

import { createServerHelpers } from '../src/runtime/server'

const rules: Record<string, Record<string, unknown>> = {
  '/base/about': { headers: { 'x-about': '1' } },
}

function helpers () {
  const fetch = vi.fn((_request: Request) => Promise.resolve(new Response('ok')))
  const match = (path: string) => rules[path] ?? {}
  return { fetch, ...createServerHelpers(match, () => Promise.resolve(fetch), '/base/') }
}

describe('`nuxt/server` on the vite server', () => {
  it('matches route rules for a path relative to the base URL', () => {
    expect(helpers().matchRouteRules('/about')).toEqual({ headers: { 'x-about': '1' } })
    expect(helpers().matchRouteRules('/other')).toEqual({})
  })

  it('matches route rules for the request', () => {
    expect(helpers().getRouteRules({ url: new URL('https://nuxt.com/base/about') })).toEqual({ headers: { 'x-about': '1' } })
  })

  it('fetches a route of the app through its handler', async () => {
    const { fetch, serverFetch } = helpers()
    const req = new Request('https://nuxt.com/base/page', { headers: { cookie: 'a=1' } })

    expect(await (await serverFetch({ req }, '/about?a=1', { method: 'POST' })).text()).toBe('ok')

    const request = fetch.mock.calls[0]![0]
    expect(request.url).toBe('https://nuxt.com/base/about?a=1')
    expect(request.method).toBe('POST')
    expect(request.headers.get('cookie')).toBe('a=1')
  })
})
