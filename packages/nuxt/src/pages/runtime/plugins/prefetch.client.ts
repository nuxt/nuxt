import { hasProtocol } from 'ufo'
import { toArray } from '../utils'
import { defineNuxtPlugin } from '#app/nuxt'
import type { ObjectPlugin, Plugin } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
import layouts from '#build/layouts'
import { namedMiddleware } from '#build/middleware'
import { _loadAsyncComponent } from '#app/composables/preload'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:prefetch',
  setup (nuxtApp) {
    const router = useRouter()

    // Force layout prefetch on route changes
    nuxtApp.hooks.hook('app:mounted', () => {
      router.beforeEach(async (to) => {
        const layout = to?.meta?.layout as keyof typeof layouts | undefined
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
      // `meta.middleware` can be a string key, a `NavigationGuard` callable,
      // or an array of either. we only prefetch named middleware (= strings).
      const middleware = toArray<unknown>(route.meta.middleware).filter((m): m is string => typeof m === 'string')

      for (const name of middleware) {
        const handler = namedMiddleware[name as keyof typeof namedMiddleware]
        if (typeof handler === 'function') {
          handler()
        }
      }

      if (typeof layout === 'string' && layout in layouts) {
        _loadAsyncComponent(layouts[layout])
      }
    })
  },
})

export default plugin
