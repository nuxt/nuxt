import { describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import { H3, HTTPError } from 'nitro/h3'
import type { NitroApp } from 'nitro/types'
import { routeRules } from 'h3/rules'

import { markRenderedErrorPage } from '../src/runtime/utils/error-page.ts'

vi.mock('nitro', () => ({ definePlugin: (plugin: unknown) => plugin }))

const { default: plugin } = await import('../src/runtime/plugins/error-cache-control.ts')

const hooks = createHooks<Record<string, (response: Response, event: unknown) => void>>()
;(plugin as (app: NitroApp) => void)({ hooks } as unknown as NitroApp)

async function respond (status: number, cacheControl: string | null, ruleHeaders: Record<string, string> | undefined, errorPage: boolean) {
  const response = new Response(null, { status, headers: cacheControl ? { 'cache-control': cacheControl } : {} })
  const context = { routeRules: ruleHeaders && { headers: ruleHeaders } }
  if (errorPage) {
    markRenderedErrorPage(context)
  }
  await hooks.callHook('response', response, { context })
  return response.headers.get('cache-control')
}

describe('error cache-control plugin', () => {
  it('replaces the cache-control of a route rule on an error page the renderer rendered', async () => {
    expect(await respond(404, 'public, max-age=60', { 'cache-control': 'public, max-age=60' }, true)).toBe('no-cache')
    expect(await respond(500, 'public, max-age=60', { 'Cache-Control': 'public, max-age=60' }, true)).toBe('no-cache')
    expect(await respond(404, 'public, max-age=60', { 'cache-control': ' public, max-age=60 ' }, true)).toBe('no-cache')
  })

  it('recognises an error page marked through another copy of the module', async () => {
    vi.resetModules()
    const copy = await import('../src/runtime/utils/error-page.ts')
    const response = new Response(null, { status: 404, headers: { 'cache-control': 'public, max-age=60' } })
    const context = { routeRules: { headers: { 'cache-control': 'public, max-age=60' } } }
    copy.markRenderedErrorPage(context)
    await hooks.callHook('response', response, { context })

    expect(copy.markRenderedErrorPage).not.toBe(markRenderedErrorPage)
    expect(response.headers.get('cache-control')).toBe('no-cache')
  })

  it('keeps the cache-control of a route rule on an error response a handler returns', async () => {
    expect(await respond(404, 'public, max-age=60', { 'cache-control': 'public, max-age=60' }, false)).toBe('public, max-age=60')
  })

  it('keeps the cache-control of a response that is not an error', async () => {
    expect(await respond(200, 'public, max-age=60', { 'cache-control': 'public, max-age=60' }, true)).toBe('public, max-age=60')
  })

  it('keeps a cache-control that does not come from a route rule', async () => {
    expect(await respond(404, 'no-store', { 'cache-control': 'public, max-age=60' }, true)).toBe('no-store')
    expect(await respond(404, 'public, max-age=60', { 'x-other': '1' }, true)).toBe('public, max-age=60')
    expect(await respond(404, 'public, max-age=60', undefined, true)).toBe('public, max-age=60')
  })

  it.each(['no-store', 'private, max-age=60', 'no-cache', 'public, no-cache'])('keeps the route rule cache-control %s on an error page the renderer rendered', async (rule) => {
    expect(await respond(404, rule, { 'cache-control': rule }, true)).toBe(rule)
  })

  it.each([
    ['no-store', 'no-store'],
    ['private, max-age=60', 'private, max-age=60'],
    ['no-cache', 'no-cache'],
    ['public, no-cache', 'public, no-cache'],
    ['public, max-age=60', 'no-cache'],
  ])('sends the route rule cache-control %s as %s on an error response without one', async (rule, expected) => {
    expect(await respond(401, null, { 'cache-control': rule }, false)).toBe(expected)
  })

  it('keeps a cache-control an error page sets over the route rule', async () => {
    expect(await respond(404, 'private, max-age=5', { 'cache-control': 'no-store' }, true)).toBe('private, max-age=5')
  })

  it('sends an error page the renderer rendered without a cache-control with no-cache', async () => {
    expect(await respond(404, null, undefined, true)).toBe('no-cache')
    expect(await respond(500, null, { 'x-other': '1' }, true)).toBe('no-cache')
  })

  it('sends an error response a handler returns without a cache-control or route rule without one', async () => {
    expect(await respond(404, null, undefined, false)).toBe(null)
  })

  it('sends a response that is not an error without a cache-control', async () => {
    expect(await respond(200, null, undefined, true)).toBe(null)
  })

  describe('in an app', () => {
    const rules = {
      '/no-store/**': { headers: { 'cache-control': 'no-store' } },
      '/private/**': { headers: { 'cache-control': 'private, max-age=60' } },
      '/public/**': { headers: { 'cache-control': 'public, max-age=60' } },
      '/no-cache/**': { headers: { 'cache-control': 'no-cache' } },
    }
    const cases = [
      ['no-store', 'no-store'],
      ['private', 'private, max-age=60'],
      ['public', 'no-cache'],
      ['no-cache', 'no-cache'],
    ]

    function app (onError?: () => Response, hook = true) {
      const h3 = new H3({
        silent: true,
        onError,
        onResponse: hook ? (response, event) => hooks.callHook('response', response, event) : undefined,
      })
      h3.use(routeRules(rules))
      h3.get('/**:path', (event) => {
        const path = event.url.pathname
        if (path.endsWith('/throw')) {
          throw new HTTPError({ status: 401 })
        }
        if (path.endsWith('/returned')) {
          return new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } })
        }
        markRenderedErrorPage(event.context)
        return new Response('<html></html>', { status: 404, headers: { 'content-type': 'text/html' } })
      })
      return h3
    }

    it.each(['no-store', 'public'])('sends an error response a handler returns under the %s route rule as h3 sends it', async (prefix) => {
      const request = () => new Request(`http://localhost/${prefix}/returned`)
      const res = await app().fetch(request())
      expect(res.status).toBe(401)
      expect(res.headers.get('cache-control')).toBe(rules[`/${prefix}/**` as keyof typeof rules].headers['cache-control'])
      expect([...res.headers]).toEqual([...(await app(undefined, false).fetch(request())).headers])
    })

    it.each(cases)('sends the %s route rule as %s with an error page the renderer renders inline', async (prefix, expected) => {
      const res = await app().fetch(new Request(`http://localhost/${prefix}/page`))
      expect(res.status).toBe(404)
      expect(res.headers.get('cache-control')).toBe(expected)
    })

    it('sends an error page the renderer renders inline outside a route rule with no-cache', async () => {
      const res = await app().fetch(new Request('http://localhost/other/page'))
      expect(res.status).toBe(404)
      expect(res.headers.get('cache-control')).toBe('no-cache')
    })

    it.each(cases)('sends the %s route rule as %s with an error response another error handler returns', async (prefix, expected) => {
      const res = await app(() => new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } })).fetch(new Request(`http://localhost/${prefix}/throw`))
      expect(res.status).toBe(401)
      expect(res.headers.get('cache-control')).toBe(expected)
    })
  })
})
