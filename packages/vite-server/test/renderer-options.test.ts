import { afterEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'nuxt/server'
import type { RendererEvent } from 'nuxt/internal/renderer/runtime'

vi.mock('#internal/nuxt/paths', () => ({ buildAssetsURL: () => '', publicAssetsURL: () => '' }))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createRendererOptions', () => {
  it('logs only server errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { createRendererOptions } = await import('../src/runtime/renderer.ts')
    const { captureError } = createRendererOptions(() => ({}) as any, () => ({}))
    const context = { event: {} as RendererEvent }

    await captureError!(createError({ status: 404 }), context)
    expect(log).not.toHaveBeenCalled()

    await captureError!(createError({ status: 500 }), context)
    await captureError!(new Error('thrown'), context)
    expect(log).toHaveBeenCalledTimes(2)
  })
})
