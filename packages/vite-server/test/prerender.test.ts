import { describe, expect, it, vi } from 'vitest'
import type { RendererEvent } from 'nuxt/internal/renderer/runtime'
import { prerenderDiagnostics } from 'nuxt/internal/renderer/diagnostics'

import { createPrerenderOptions } from '../src/runtime/prerender.ts'

const event = (url: string) => ({ url: new URL(url, 'http://localhost') }) as RendererEvent

describe('createPrerenderOptions', () => {
  it('responds with 508 to a request for a URL that is already rendering', async () => {
    const loop = vi.spyOn(prerenderDiagnostics, 'NUXT_E8018').mockImplementation(() => ({}) as any)
    const { wrapRender } = createPrerenderOptions()

    const nested = wrapRender!(event('/page'), () => wrapRender!(event('/other'), () => wrapRender!(event('/page'), () => Promise.resolve(new Response('page')))))

    expect((await nested).status).toBe(508)
    expect(loop).toHaveBeenCalledOnce()
    expect(loop).toHaveBeenCalledWith({ url: '/page', chain: '`/page` -> `/other` -> `/page`' })
  })
})
