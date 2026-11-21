import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp, toWebHandler } from 'h3'
import { prerenderDiagnostics } from 'nuxt/internal/renderer/diagnostics'

vi.mock('#internal/nuxt/nitro-config.mjs', () => ({ NUXT_SHARED_DATA: false }))
vi.mock('#internal/nuxt/route-rules.mjs', () => ({ normalizeRouteRulePath: (path: string) => path, matchAllRouteRules: () => [] }))
vi.mock('#internal/nuxt/dev-client-css', () => ({ getDevClientCss: () => undefined }))
vi.mock('nitropack/runtime', () => ({
  useNitroApp: () => ({}),
  useRuntimeConfig: () => ({ app: {} }),
  useStorage: () => ({ getItem: () => null, setItem: () => {} }),
}))

describe('island handler while prerendering', () => {
  beforeAll(() => {
    vi.stubGlobal('__TEST_PRERENDER__', true)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('responds with 508 to a request for an island that is already rendering', async () => {
    const loop = vi.spyOn(prerenderDiagnostics, 'NUXT_E8019').mockImplementation(() => ({}) as any)
    const { prerenderRenderingURLs } = await import('../src/runtime/utils/cache.ts')
    const { default: handler } = await import('../src/runtime/handlers/island.ts')
    const fetch = toWebHandler(createApp().use(handler))
    const island = '/__nuxt_island/Self_abc.json'

    const response = await prerenderRenderingURLs!.run(['/page', island], () => fetch(new Request(`http://localhost${island}`)))

    expect(response.status).toBe(508)
    expect(loop).toHaveBeenCalledOnce()
    expect(loop).toHaveBeenCalledWith({ url: island, chain: `\`/page\` -> \`${island}\` -> \`${island}\`` })
  })
})
