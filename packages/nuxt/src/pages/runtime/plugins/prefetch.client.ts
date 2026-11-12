import { hasProtocol } from 'ufo'
import { defineNuxtPlugin } from '#app/nuxt'
import type { ObjectPlugin, Plugin } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
import layouts from '#build/layouts'
import { namedMiddleware } from '#build/middleware'
import { _loadAsyncComponent } from '#app/composables/preload'
import { usePrefetchScheduler } from '#app/internal/prefetch-scheduler'
import { canPrefetch, prefetchGroup } from '#app/internal/prefetch-util'
import { componentIslands, routeChunkHints } from '#build/nuxt.config.mjs'
import { toArray } from '#app/utils'
import { preloadLayoutChunks, warmRouteChunkHints } from '#app/internal/preload-hints'
import { PRELOAD_MODULE_KEY } from '#app/internal/preload-hints-shared'

async function prefetchLayout (layout: string) {
  const component = layouts[layout as keyof typeof layouts]
  // a loaded layout may have its styles inlined, where no `<link>` shows that a hint would fetch them again
  if ((component as { __asyncResolved?: boolean }).__asyncResolved) {
    return
  }
  if (!await preloadLayoutChunks(layout)) {
    await _loadAsyncComponent(component)
  }
}

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:prefetch',
  setup (nuxtApp) {
    const router = useRouter()

    if (routeChunkHints && canPrefetch()) {
      warmRouteChunkHints()
    }

    // Force layout prefetch on route changes
    nuxtApp.hooks.hook('app:mounted', () => {
      router.beforeEach(async (to) => {
        const layout = to?.meta?.layout
        if (typeof layout === 'string' && layout in layouts) {
          await _loadAsyncComponent(layouts[layout])
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
            loading.push(routeChunkHints ? prefetchLayout(layout) : _loadAsyncComponent(layouts[layout]))
          }
          return Promise.all(loading).catch(() => {})
        },
      })

      // importing the page in dev would transform it and all its components for every visible link,
      // which `<NuxtLink>` already avoids for route components in dev
      if (componentIslands && !import.meta.dev) {
        await Promise.all(route.matched.map((record) => {
          const component = record.components?.default
          // Only server pages define `__nuxt_prefetch`. With hints, the build marks their loaders,
          // so that no other route component is run to look for it.
          if (typeof component !== 'function' || (routeChunkHints && (component as unknown as Record<string, unknown>)[PRELOAD_MODULE_KEY] !== false)) { return }
          return Promise.resolve((component as () => unknown)())
            .then((c: any) => (c?.default || c)?.__nuxt_prefetch?.(nuxtApp, route))
            .catch(() => {})
        }))
      }
    })
  },
})

export default plugin
