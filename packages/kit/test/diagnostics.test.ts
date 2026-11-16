import { describe, expect, it, vi } from 'vitest'

describe('diagnostics', () => {
  it.each([
    ['4.7.0', '4.x'],
    ['5.0.0', '5.x'],
  ])('links to the docs of its own major version (%s)', async (version, docsVersion) => {
    vi.resetModules()
    vi.doMock('../package.json', () => ({ default: { version } }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { pageDiagnostics } = await import('../src/diagnostics/pages.ts')
    const diagnostic = pageDiagnostics.NUXT_B4025({ tag: 'NuxtLink', attribute: 'to', to: '/missing', file: 'app.vue' })

    expect(diagnostic.docs).toBe(`https://nuxt.com/docs/${docsVersion}/errors/b4025`)
  })
})
