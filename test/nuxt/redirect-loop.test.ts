import { describe, expect, it, vi } from 'vitest'

import { clearError } from '#app/composables/error'
import { addRouteMiddleware, useRouter } from '#app/composables/router'
import type { RouteMiddleware } from '#app/composables/router'
import { useNuxtApp } from '#app/nuxt'

describe('redirect loop detection', () => {
  it('isolates redirect tracking between concurrent navigations', async () => {
    vi.stubGlobal('__TEST_DEV__', true)
    const nuxtApp = useNuxtApp()
    const router = useRouter()

    let releaseFirstTarget: (() => void) | undefined
    let firstTargetEntered: (() => void) | undefined
    const entered = new Promise<void>((resolve) => { firstTargetEntered = resolve })
    let pauseNextTarget = true
    const middleware: RouteMiddleware = async (to) => {
      if (to.path === '/redirect-source-a' || to.path === '/redirect-source-b') {
        return '/redirect-target'
      }
      if (to.path === '/redirect-target' && pauseNextTarget) {
        pauseNextTarget = false
        firstTargetEntered!()
        await new Promise<void>((resolve) => { releaseFirstTarget = resolve })
      }
    }
    addRouteMiddleware(middleware)

    const older = router.push('/redirect-source-a')
    await entered

    try {
      const newerResult = await router.push('/redirect-source-b')
      expect(newerResult).toBeUndefined()
      releaseFirstTarget!()
      await older

      expect(router.currentRoute.value.path).toBe('/redirect-target')
    } finally {
      releaseFirstTarget?.()
      await Promise.allSettled([older])
      const middlewareIndex = nuxtApp._middleware.global.indexOf(middleware)
      if (middlewareIndex !== -1) {
        nuxtApp._middleware.global.splice(middlewareIndex, 1)
      }
      await clearError()
      await router.replace('/')
      vi.unstubAllGlobals()
    }
  })
})
