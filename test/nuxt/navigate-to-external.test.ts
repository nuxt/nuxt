import { describe, expect, it, vi } from 'vitest'
import { navigateTo, useNuxtApp } from '#app'

describe('navigateTo external', () => {
  it('defers scope cleanup until the page unloads', async () => {
    const nuxtApp = useNuxtApp()
    const locationStub = { href: '', replace: vi.fn() }
    const location = vi.spyOn(window, 'location', 'get').mockReturnValue(locationStub as unknown as Location)

    try {
      await navigateTo('https://example.com', { external: true })

      expect(locationStub.href).toBe('https://example.com')
      expect(nuxtApp._scope.active).toBe(true)

      window.dispatchEvent(new Event('pagehide'))

      expect(nuxtApp._scope.active).toBe(false)
    } finally {
      location.mockRestore()
    }
  })
})
