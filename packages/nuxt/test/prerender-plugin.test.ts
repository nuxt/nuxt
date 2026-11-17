import { afterEach, describe, expect, it, vi } from 'vitest'

const { matcher, prerenderRoutes, diagnostics } = vi.hoisted(() => ({
  matcher: vi.fn((path: string): Record<string, unknown> => {
    if (path === '/about') { throw new Error('invalid route rules') }
    return { prerender: true }
  }),
  prerenderRoutes: vi.fn(),
  diagnostics: { NUXT_E5003: vi.fn() },
}))

vi.mock('#build/route-rules.mjs', () => ({ default: matcher }))
vi.mock('#build/routes', () => ({
  default: [
    { path: '/about' },
    { path: '/blog', children: [{ path: ':slug?' }] },
  ],
}))
vi.mock('../src/app/composables/ssr', () => ({ prerenderRoutes }))
vi.mock('../src/app/diagnostics/manifest', () => ({ manifestDiagnostics: diagnostics }))

describe('prerender plugin', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('skips a route whose route rules cannot be matched', async () => {
    vi.stubGlobal('__TEST_SERVER__', true)
    vi.stubGlobal('__TEST_PRERENDER__', true)
    const { default: plugin } = await import('../src/pages/runtime/plugins/prerender.server')

    await plugin({} as any)

    expect(prerenderRoutes).toHaveBeenCalledWith(['/blog'])
    expect(diagnostics.NUXT_E5003).toHaveBeenCalledWith({ path: '/about', cause: expect.objectContaining({ message: 'invalid route rules' }) })
  })
})
