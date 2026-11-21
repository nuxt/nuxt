import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { RendererEvent } from 'nuxt/internal/renderer/runtime'

const clearErrorReport = vi.hoisted(() => vi.fn())

vi.mock('#internal/nuxt/nitro-config.mjs', () => ({ NUXT_SHARED_DATA: false }))
vi.mock('#internal/nuxt/error-channel', () => ({ clearErrorReport }))
vi.mock('nitro/app', async importOriginal => ({ ...await importOriginal<typeof import('nitro/app')>(), useNitroApp: () => ({}) }))

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

  it('marks a request the renderer answers with its own error page', async () => {
    const { rendererOptions } = await import('../src/runtime/utils/renderer/options.ts')
    const { isRenderedErrorPage } = await import('../src/runtime/utils/error-page.ts')
    const event = (context: object) => ({ req: new Request('http://localhost/page'), url: new URL('http://localhost/page'), context }) as unknown as RendererEvent

    const page = {}
    await rendererOptions.captureError!(new Error('page'), { event: event(page) })
    const nested = {}
    await rendererOptions.captureError!(new Error('error page'), { event: event(nested), tags: ['error-page'] })
    const streamed = {}
    await rendererOptions.captureError!(new Error('stream'), { event: event(streamed), tags: ['streaming'] })

    expect([isRenderedErrorPage(page), isRenderedErrorPage(nested), isRenderedErrorPage(streamed)]).toEqual([true, true, false])
  })

  it('does not mark a request for an error captured with another tag', async () => {
    const { rendererOptions } = await import('../src/runtime/utils/renderer/options.ts')
    const { isRenderedErrorPage } = await import('../src/runtime/utils/error-page.ts')
    const context = {}
    const event = { req: new Request('http://localhost/page'), url: new URL('http://localhost/page'), context } as unknown as RendererEvent

    await rendererOptions.captureError!(new Error('masked'), { event, tags: ['async-data'] })
    await rendererOptions.captureError!(new Error('other'), { event, tags: ['custom'] })

    expect(isRenderedErrorPage(context)).toBe(false)
  })
})

describe('renderer options while prerendering', () => {
  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('leaves logging a 5xx error of a prerender request to the prerenderer', async () => {
    vi.resetModules()
    vi.stubGlobal('__TEST_DEV__', false)
    vi.stubGlobal('__TEST_PRERENDER__', true)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rendererOptions } = await import('../src/runtime/utils/renderer/options.ts')
    const event = (headers: Record<string, string>) => ({ req: new Request('http://localhost/page', { headers }), url: new URL('http://localhost/page'), context: {} }) as unknown as RendererEvent
    const prerender = { 'x-nitro-prerender': '/page' }

    await rendererOptions.captureError!(Object.assign(new Error('handled'), { status: 500 }), { event: event(prerender) })
    expect(log).not.toHaveBeenCalled()

    await rendererOptions.captureError!(Object.assign(new Error('not prerendering'), { status: 500 }), { event: event({}) })
    await rendererOptions.captureError!(new Error('without status'), { event: event(prerender) })
    await rendererOptions.captureError!(Object.assign(new Error('unhandled'), { status: 500, unhandled: true }), { event: event(prerender) })
    expect(log).toHaveBeenCalledTimes(3)
    log.mockRestore()
  })
})
