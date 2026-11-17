import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { RendererEvent } from 'nuxt/internal/renderer/runtime'

const clearErrorReport = vi.hoisted(() => vi.fn())

vi.mock('#internal/nuxt/nitro-config.mjs', () => ({ NUXT_SHARED_DATA: false }))
vi.mock('#internal/nuxt/error-channel', () => ({ clearErrorReport }))

describe('renderer options', () => {
  beforeAll(() => {
    vi.stubGlobal('__TEST_DEV__', true)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('clears the dev error reports of the URL the app was given', async () => {
    const { rendererOptions } = await import('../src/runtime/utils/renderer/options.ts')
    const appURL = new URL('http://localhost/foo/url')
    const event = { 'url': new URL('http://localhost/url'), '~app': { url: appURL } } as unknown as RendererEvent

    rendererOptions.onRenderSuccess!(event)

    await vi.waitFor(() => expect(clearErrorReport).toHaveBeenCalledWith(appURL))
  })
})
