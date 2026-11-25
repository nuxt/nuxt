import { describe, expect, it, vi } from 'vitest'

describe('diagnostics', () => {
  it('links to the docs of its own major version', async () => {
    vi.resetModules()
    vi.doMock('../package.json', () => ({ default: { version: '4.7.0' } }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { pageDiagnostics } = await import('../src/diagnostics/pages.ts')
    const diagnostic = pageDiagnostics.NUXT_B4025({ tag: 'NuxtLink', attribute: 'to', to: '/missing', file: 'app.vue' })

    expect(diagnostic.docs).toBe('https://nuxt.com/docs/4.x/errors/b4025')
  })
})
