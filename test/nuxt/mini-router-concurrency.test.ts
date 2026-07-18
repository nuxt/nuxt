import { describe, expect, it } from 'vitest'
import { useNuxtApp } from '#app/nuxt'
import miniRouterPlugin from '#app/plugins/router'

describe('built-in mini-router concurrency (#31762)', () => {
  it('applies the latest navigation when concurrent navigations race', async () => {
    const nuxtApp = useNuxtApp()
    // Instantiate the built-in mini-router in isolation.
    const { provide } = (await (miniRouterPlugin as any).setup(nuxtApp)) as { provide: { router: any } }
    const router = provide.router

    // Slow down navigation to /slow so the older call resolves AFTER the newer one.
    router.beforeEach(async (to: { path: string }) => {
      if (to.path === '/slow') {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    })

    // Older call -> /slow (delayed), newer call -> /fast (instant).
    const older = router.push('/slow')
    const newer = router.push('/fast')
    await Promise.all([older, newer])
    // Give the delayed navigation time to (previously) overwrite the newer one.
    await new Promise(resolve => setTimeout(resolve, 100))

    // Last navigation wins: the delayed older call must NOT overwrite /fast.
    expect(router.currentRoute.value.path).toBe('/fast')
  })
})
