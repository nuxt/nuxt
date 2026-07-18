import { describe, expect, it } from 'vitest'
import { useNuxtApp } from '#app/nuxt'
import miniRouterPlugin from '#app/plugins/router'

describe('built-in mini-router', () => {
  it('applies the latest navigation when concurrent navigations race', async () => {
    const result = await miniRouterPlugin.setup!(useNuxtApp())
    const { router } = result!.provide!

    let resolveSlowGuard: () => void
    router.beforeEach(async (to) => {
      if (to.path === '/slow') {
        await new Promise<void>((resolve) => { resolveSlowGuard = resolve })
      }
    })

    const older = router.push('/slow')
    const newer = router.push('/fast')
    await newer
    resolveSlowGuard!()
    await older

    expect(router.currentRoute.value.path).toBe('/fast')
  })
})
