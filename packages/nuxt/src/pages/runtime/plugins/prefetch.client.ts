import { hasProtocol } from 'ufo'
import { toArray } from '../utils'
import { defineNuxtPlugin } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
// @ts-expect-error virtual file
import layouts from '#build/layouts'
// @ts-expect-error virtual file
import { namedMiddleware } from '#build/middleware'
import { _loadAsyncComponent } from '#app/composables/preload'

export default defineNuxtPlugin({
  name: 'nuxt:prefetch',
  setup (nuxtApp) {
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
      const layout = route.meta.layout
      let middleware = toArray(route.meta.middleware)
      middleware = middleware.filter(m => typeof m === 'string')

      for (const name of middleware) {
        if (typeof namedMiddleware[name] === 'function') {
          namedMiddleware[name]()
        }
      }

      if (typeof layout === 'string' && layout in layouts) {
        _loadAsyncComponent(layouts[layout])
      }
    })
  },
})
