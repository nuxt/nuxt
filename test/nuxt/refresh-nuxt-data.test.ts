/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { requestIdleCallback } from '#app/compat/idle-callback'
import { refreshNuxtData } from '#app/composables/asyncData'
import { useNuxtApp } from '#app/nuxt'

vi.mock('#app/compat/idle-callback', () => ({
  requestIdleCallback: vi.fn(),
  cancelIdleCallback: vi.fn(),
}))

describe('refreshNuxtData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should refresh immediately when nuxt is already hydrated', async () => {
    const nuxtApp = useNuxtApp()
    nuxtApp.isHydrating = false
    const onRefresh = vi.fn()
    const removeHook = nuxtApp.hooks.hook('app:data:refresh', onRefresh)

    try {
      const refresh = refreshNuxtData('key')
      await Promise.resolve()

      expect(onRefresh).toHaveBeenCalledWith(['key'])
      expect(vi.mocked(requestIdleCallback)).not.toHaveBeenCalled()
      await refresh
    } finally {
      removeHook()
    }
  })
})
