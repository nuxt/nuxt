import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import type { Nitro, PrerenderRoute } from 'nitropack/types'

import { failOnPrerenderErrors } from '../src/prerender.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

function createNitro (prerender: Record<string, unknown> = {}) {
  return { hooks: createHooks(), options: { prerender: { failOnError: true, ...prerender } } } as unknown as Nitro
}

const failed = (route: string, statusCode: number): PrerenderRoute => ({ route, error: Object.assign(new Error(`[${statusCode}]`), { statusCode, statusMessage: '' }) })

async function prerender (nitro: Nitro, failedRoutes: PrerenderRoute[]) {
  await nitro.hooks.callHook('prerender:init', {} as Nitro)
  await nitro.hooks.callHook('prerender:done', { prerenderedRoutes: [], failedRoutes })
}

describe('failOnPrerenderErrors', () => {
  it('throws a diagnostic naming the failed routes after every other prerender:done listener', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const nitro = createNitro()
    failOnPrerenderErrors(nitro)
    const listener = vi.fn()
    nitro.hooks.hook('prerender:done', listener)

    await expect(prerender(nitro, [failed('/broken', 500), failed('/missing', 404)])).rejects.toMatchObject({
      code: 'NUXT_B1024',
      message: '2 routes failed to prerender: `/broken` (500), `/missing` (404).',
    })
    expect(listener).toHaveBeenCalledOnce()
  })

  it('lists at most five routes and omits a missing status', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const nitro = createNitro()
    failOnPrerenderErrors(nitro)
    const routes = [{ route: '/unknown', error: new Error('boom') } as PrerenderRoute, ...['/2', '/3', '/4', '/5', '/6', '/7'].map(route => failed(route, 500))]

    await expect(prerender(nitro, routes)).rejects.toMatchObject({
      message: '7 routes failed to prerender: `/unknown`, `/2` (500), `/3` (500), `/4` (500), `/5` (500) and 2 more.',
    })
  })

  it('does not throw when failOnError is disabled', async () => {
    const nitro = createNitro({ failOnError: false })
    failOnPrerenderErrors(nitro)

    await expect(prerender(nitro, [failed('/broken', 500)])).resolves.toBeUndefined()
  })
})
