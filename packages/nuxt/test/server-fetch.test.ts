import { describe, expect, it } from 'vitest'

import { serverFetch } from '../src/server/index'
import { resolveServerFetchInit } from '../src/server/fetch'
import type { RequestEvent } from '../src/server/index'

function event (headers: Record<string, string>): RequestEvent {
  const req = new Request('https://nuxt.com/page', { headers })
  return { req, url: new URL(req.url), res: { headers: new Headers() }, context: {} }
}

describe('`serverFetch`', () => {
  it('forwards the cookie and authorization headers and nothing else by default', () => {
    const init = resolveServerFetchInit(event({ 'cookie': 'a=1', 'authorization': 'Bearer x', 'x-other': 'y' }))
    expect(Object.fromEntries(init.headers as Headers)).toEqual({ cookie: 'a=1', authorization: 'Bearer x' })
  })

  it('lets `init.headers` win over forwarded headers', () => {
    const init = resolveServerFetchInit(event({ cookie: 'a=1' }), { headers: { cookie: 'b=2' } })
    expect((init.headers as Headers).get('cookie')).toBe('b=2')
  })

  it('forwards no header, or only the listed ones, when asked', () => {
    const e = event({ 'cookie': 'a=1', 'authorization': 'Bearer x', 'x-other': 'y' })
    expect([...(resolveServerFetchInit(e, { forwardHeaders: false }).headers as Headers)]).toEqual([])
    expect(Object.fromEntries(resolveServerFetchInit(e, { forwardHeaders: ['x-other'] }).headers as Headers)).toEqual({ 'x-other': 'y' })
  })

  it('does not pass `forwardHeaders` on to the request', () => {
    const init = resolveServerFetchInit(event({}), { method: 'POST', forwardHeaders: false })
    expect(init).not.toHaveProperty('forwardHeaders')
    expect(init.method).toBe('POST')
  })

  it('rejects without a server builder', async () => {
    await expect(serverFetch(event({}), '/api')).rejects.toMatchObject({ status: 500 })
  })
})
