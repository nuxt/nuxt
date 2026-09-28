import { hasProtocol } from 'ufo'
import { toArray } from '../utils'
import { defineNuxtPlugin } from '#app/nuxt'
import type { ObjectPlugin, Plugin } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
import layouts from '#build/layouts'
import { namedMiddleware } from '#build/middleware'
import { _loadAsyncComponent } from '#app/composables/preload'
import { usePrefetchScheduler } from '#app/internal/prefetch-scheduler'
import { prefetchGroup } from '#app/internal/prefetch-util'
import { componentIslands } from '#build/nuxt.config.mjs'

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
    const { schedule } = usePrefetchScheduler(nuxtApp)
    nuxtApp.hooks.hook('link:prefetch', async (url) => {
      if (hasProtocol(url)) { return }
      const route = router.resolve(url)
      if (!route) { return }
      const layout = route.meta.layout
      // `meta.middleware` can be a string key, a `NavigationGuard` callable,
      // or an array of either. we only prefetch named middleware (= strings).
      const middleware = toArray<unknown>(route.meta.middleware).filter((m): m is string => typeof m === 'string')

      schedule({
        key: `route:chunks:${url}`,
        priority: 'route',
        scope: 'navigation',
        group: prefetchGroup(url),
        run: (signal) => {
          if (signal.aborted) { return }
          const loading: unknown[] = []
          for (const name of middleware) {
            const handler = namedMiddleware[name as keyof typeof namedMiddleware]
            if (typeof handler === 'function') {
              loading.push(handler())
            }
          }

          if (typeof layout === 'string' && layout in layouts) {
            loading.push(_loadAsyncComponent(layouts[layout]))
          }
          return Promise.all(loading).catch(() => {})
        },
      })

      if (componentIslands) {
        await Promise.all(route.matched.map((record) => {
          const component = record.components?.default
          if (typeof component !== 'function') { return }
          return Promise.resolve((component as () => unknown)())
            .then((c: any) => (c?.default || c)?.__nuxt_prefetch?.(nuxtApp, route))
            .catch(() => {})
        }))
      }
    })
  },
})

export default plugin
