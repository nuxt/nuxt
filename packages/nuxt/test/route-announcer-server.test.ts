import { describe, expect, it, vi } from 'vitest'

const hook = vi.fn()
const nuxtApp: Record<string, unknown> = {}

vi.mock('#app/nuxt', () => ({
  useNuxtApp: () => nuxtApp,
}))

vi.mock('../src/app/composables/head', () => ({
  injectHead: () => ({ hooks: { hook, removeHook: () => {} } }),
}))

const { useRouteAnnouncer } = await import('../src/app/composables/route-announcer.ts')

describe('useRouteAnnouncer on the server', () => {
  it('does not access `document` or register head hooks', () => {
    vi.stubGlobal('__TEST_SERVER__', true)
    try {
      const { message } = useRouteAnnouncer()
      expect(message.value).toBe('')
      expect(hook).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
