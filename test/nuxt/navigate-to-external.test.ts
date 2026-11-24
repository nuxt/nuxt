import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { navigateTo, useCookie, useNuxtApp } from '#app'

describe('navigateTo external', () => {
  const locationStub = { href: '', pathname: '/', protocol: 'http:', replace: vi.fn() }

  beforeEach(() => {
    locationStub.href = ''
    vi.spyOn(window, 'location', 'get').mockReturnValue(locationStub as unknown as Location)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes cookie values before navigating', async () => {
    const nuxtApp = useNuxtApp()
    const cookie = nuxtApp.runWithContext(() => useCookie('navigate-external', { watch: false }))
    cookie.value = 'pending'
    expect(document.cookie).not.toContain('navigate-external=pending')

    const navigation = navigateTo('https://example.com', { external: true })

    expect(document.cookie).toContain('navigate-external=pending')
    await navigation
  })

  it('keeps the app scope active when the page enters the back/forward cache', async () => {
    const nuxtApp = useNuxtApp()

    await navigateTo('https://example.com', { external: true })
    window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: true }))

    expect(nuxtApp._scope.active).toBe(true)
  })

  it('defers scope cleanup until the page unloads', async () => {
    const nuxtApp = useNuxtApp()

    await navigateTo('https://example.com', { external: true })

    expect(locationStub.href).toBe('https://example.com')
    expect(nuxtApp._scope.active).toBe(true)

    window.dispatchEvent(new Event('pagehide'))

    expect(nuxtApp._scope.active).toBe(false)
  })
})
