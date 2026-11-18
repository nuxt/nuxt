import { describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import type { NitroApp } from 'nitro/types'

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
})
