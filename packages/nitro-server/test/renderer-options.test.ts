import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { RendererEvent } from 'nuxt/internal/renderer/runtime'
import { prerenderDiagnostics } from 'nuxt/internal/renderer/diagnostics'

vi.mock('#internal/nuxt/nitro-config.mjs', () => ({ NUXT_SHARED_DATA: false }))
vi.mock('#internal/nuxt/route-rules.mjs', () => ({ normalizeRouteRulePath: (path: string) => path, matchAllRouteRules: () => [] }))
vi.mock('nitropack/runtime', () => ({
  useNitroApp: () => ({}),
  useRuntimeConfig: () => ({ app: {} }),
  useStorage: () => ({ getItem: () => null, setItem: () => {} }),
}))

describe('renderer options while prerendering', () => {
  beforeAll(() => {
    vi.stubGlobal('__TEST_PRERENDER__', true)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('responds with 508 to a prerender request for a URL that is already rendering', async () => {
    const loop = vi.spyOn(prerenderDiagnostics, 'NUXT_E8018').mockImplementation(() => ({}) as any)
    const { rendererOptions } = await import('../src/runtime/utils/renderer/options.ts')
    const { wrapRender } = rendererOptions.prerender!
    const event = (path: string) => ({ '~app': { path } }) as unknown as RendererEvent

    const nested = wrapRender!(event('/page'), () => wrapRender!(event('/other'), () => wrapRender!(event('/page'), () => Promise.resolve(new Response('page')))))

    expect((await nested).status).toBe(508)
    expect(loop).toHaveBeenCalledOnce()
    expect(loop).toHaveBeenCalledWith({ url: '/page', chain: '`/page` -> `/other` -> `/page`' })
  })
})
