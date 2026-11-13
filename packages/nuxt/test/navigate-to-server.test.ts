import { afterEach, describe, expect, it, vi } from 'vitest'

const nuxtApp = {
  ssrContext: {} as Record<string, unknown>,
  callHook: () => Promise.resolve(),
  $router: {
    resolve: (to: string) => ({ fullPath: to, href: to }),
    afterEach: () => {},
  },
}

vi.mock('#app/nuxt', () => ({
  useNuxtApp: () => nuxtApp,
  tryUseNuxtApp: () => nuxtApp,
  useRuntimeConfig: () => ({ app: { baseURL: '/' } }),
  isInComponentSetup: () => false,
}))

const { navigateTo } = await import('../src/app/composables/router.ts')

describe('navigateTo on the server', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    nuxtApp.ssrContext = {}
  })

  it('does not redirect when the `open` option is passed', async () => {
    vi.stubGlobal('__TEST_SERVER__', true)
    await expect(Promise.resolve(navigateTo('/internal', { open: { target: '_blank' } }))).resolves.toBeUndefined()
    await expect(Promise.resolve(navigateTo('https://example.com', { external: true, open: { target: '_blank' } }))).resolves.toBeUndefined()
    expect(nuxtApp.ssrContext['~renderResponse']).toBeUndefined()
  })

  it('rejects script protocols when the `open` option is passed', () => {
    vi.stubGlobal('__TEST_SERVER__', true)
    for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>']) {
      for (const external of [undefined, true]) {
        expect(() => navigateTo(url, { external, open: { target: '_blank' } })).toThrow(
          expect.objectContaining({ code: 'NUXT_E2002' }),
        )
      }
    }
    expect(nuxtApp.ssrContext['~renderResponse']).toBeUndefined()
  })

  it('redirects without the `open` option', async () => {
    vi.stubGlobal('__TEST_SERVER__', true)
    await navigateTo('/internal')
    expect((nuxtApp.ssrContext['~renderResponse'] as Response).headers.get('location')).toBe('/internal')
  })
})
