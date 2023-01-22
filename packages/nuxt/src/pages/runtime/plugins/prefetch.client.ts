import { hasProtocol } from 'ufo'
import { defineNuxtPlugin, useNuxtApp, useRouter } from '#app'
// @ts-ignore
import layouts from '#build/layouts'
// @ts-ignore
import { namedMiddleware } from '#build/middleware'

export default defineNuxtPlugin(() => {
  const nuxtApp = useNuxtApp()
  const router = useRouter()

  // Force layout prefetch on route changes
  nuxtApp.hooks.hook('app:mounted', () => {
    router.beforeEach(async (to) => {
      const layout = to?.meta?.layout
      if (layout && typeof layouts[layout] === 'function') {
        await layouts[layout]()
      }
    })
  })
  // Prefetch layouts & middleware
  nuxtApp.hooks.hook('link:prefetch', (url) => {
    if (hasProtocol(url)) { return }
    const route = router.resolve(url)
    if (!route) { return }
    const layout = route?.meta?.layout
    let middleware = Array.isArray(route?.meta?.middleware) ? route?.meta?.middleware : [route?.meta?.middleware]
    middleware = middleware.filter(m => typeof m === 'string')

    for (const name of middleware) {
      if (typeof namedMiddleware[name] === 'function') {
        namedMiddleware[name]()
      }
    }

    if (layout && typeof layouts[layout] === 'function') {
      layouts[layout]()
    }
  })
})
