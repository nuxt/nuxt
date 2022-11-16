import { computed, reactive, shallowRef } from 'vue'
import {
  createRouter,
  createWebHistory,
  createMemoryHistory,
  createWebHashHistory,
  NavigationGuard,
  RouteLocation
} from 'vue-router'
import { createError } from 'h3'
import { withoutBase, isEqual } from 'ufo'
import NuxtPage from './page'
import { callWithNuxt, defineNuxtPlugin, useRuntimeConfig, showError, clearError, navigateTo, useError, useState } from '#app'
// @ts-ignore
import _routes from '#build/routes'
// @ts-ignore
import routerOptions from '#build/router.options'
// @ts-ignore
import { globalMiddleware, namedMiddleware } from '#build/middleware'

declare module '@vue/runtime-core' {
  export interface GlobalComponents {
    NuxtPage: typeof NuxtPage
  }
}

// https://github.com/vuejs/router/blob/4a0cc8b9c1e642cdf47cc007fa5bbebde70afc66/packages/router/src/history/html5.ts#L37
function createCurrentLocation (
  base: string,
  location: Location
): string {
  const { pathname, search, hash } = location
  // allows hash bases like #, /#, #/, #!, #!/, /#!/, or even /folder#end
  const hashPos = base.indexOf('#')
  if (hashPos > -1) {
    const slicePos = hash.includes(base.slice(hashPos))
      ? base.slice(hashPos).length
      : 1
    let pathFromHash = hash.slice(slicePos)
    // prepend the starting slash to hash so the url starts with /#
    if (pathFromHash[0] !== '/') { pathFromHash = '/' + pathFromHash }
    return withoutBase(pathFromHash, '')
  }
  const path = withoutBase(pathname, base)
  return path + search + hash
}

export default defineNuxtPlugin(async (nuxtApp) => {
  let routerBase = useRuntimeConfig().app.baseURL
  if (routerOptions.hashMode && !routerBase.includes('#')) {
    // allow the user to provide a `#` in the middle: `/base/#/app`
    routerBase += '#'
  }

  const history = routerOptions.history?.(routerBase) ?? (process.client
    ? (routerOptions.hashMode ? createWebHashHistory(routerBase) : createWebHistory(routerBase))
    : createMemoryHistory(routerBase)
  )

  const routes = routerOptions.routes?.(_routes) ?? _routes

  const initialURL = process.server ? nuxtApp.ssrContext!.url : createCurrentLocation(routerBase, window.location)
  const router = createRouter({
    ...routerOptions,
    history,
    routes
  })
  nuxtApp.vueApp.use(router)

  const previousRoute = shallowRef(router.currentRoute.value)
  router.afterEach((_to, from) => {
    previousRoute.value = from
  })

  Object.defineProperty(nuxtApp.vueApp.config.globalProperties, 'previousRoute', {
    get: () => previousRoute.value
  })

  // Allows suspending the route object until page navigation completes
  const _route = shallowRef(router.resolve(initialURL) as RouteLocation)
  const syncCurrentRoute = () => { _route.value = router.currentRoute.value }
  nuxtApp.hook('page:finish', syncCurrentRoute)
  router.afterEach((to, from) => {
    // We won't trigger suspense if the component is reused between routes
    // so we need to update the route manually
    if (to.matched[0]?.components?.default === from.matched[0]?.components?.default) {
      syncCurrentRoute()
    }
  })

  // https://github.com/vuejs/router/blob/main/packages/router/src/router.ts#L1225-L1233
  const route = {} as RouteLocation
  for (const key in _route.value) {
    (route as any)[key] = computed(() => _route.value[key as keyof RouteLocation])
  }

  nuxtApp._route = reactive(route)

  nuxtApp._middleware = nuxtApp._middleware || {
    global: [],
    named: {}
  }

  const error = useError()

  try {
    if (process.server) {
      await router.push(initialURL)
    }

    await router.isReady()
  } catch (error: any) {
    // We'll catch 404s here
    callWithNuxt(nuxtApp, showError, [error])
  }

  const initialLayout = useState('_layout')
  router.beforeEach(async (to, from) => {
    to.meta = reactive(to.meta)
    if (nuxtApp.isHydrating) {
      to.meta.layout = initialLayout.value ?? to.meta.layout
    }
    nuxtApp._processingMiddleware = true

    type MiddlewareDef = string | NavigationGuard
    const middlewareEntries = new Set<MiddlewareDef>([...globalMiddleware, ...nuxtApp._middleware.global])
    for (const component of to.matched) {
      const componentMiddleware = component.meta.middleware as MiddlewareDef | MiddlewareDef[]
      if (!componentMiddleware) { continue }
      if (Array.isArray(componentMiddleware)) {
        for (const entry of componentMiddleware) {
          middlewareEntries.add(entry)
        }
      } else {
        middlewareEntries.add(componentMiddleware)
      }
    }

    for (const entry of middlewareEntries) {
      const middleware = typeof entry === 'string' ? nuxtApp._middleware.named[entry] || await namedMiddleware[entry]?.().then((r: any) => r.default || r) : entry

      if (!middleware) {
        if (process.dev) {
          throw new Error(`Unknown route middleware: '${entry}'. Valid middleware: ${Object.keys(namedMiddleware).map(mw => `'${mw}'`).join(', ')}.`)
        }
        throw new Error(`Unknown route middleware: '${entry}'.`)
      }

      const result = await callWithNuxt(nuxtApp, middleware, [to, from])
      if (process.server || (!nuxtApp.payload.serverRendered && nuxtApp.isHydrating)) {
        if (result === false || result instanceof Error) {
          const error = result || createError({
            statusCode: 404,
            statusMessage: `Page Not Found: ${initialURL}`
          })
          await callWithNuxt(nuxtApp, showError, [error])
          return false
        }
      }
      if (result || result === false) { return result }
    }
  })

  router.afterEach(async (to) => {
    delete nuxtApp._processingMiddleware

    if (process.client && !nuxtApp.isHydrating && error.value) {
      // Clear any existing errors
      await callWithNuxt(nuxtApp, clearError)
    }
    if (to.matched.length === 0) {
      callWithNuxt(nuxtApp, showError, [createError({
        statusCode: 404,
        fatal: false,
        statusMessage: `Page not found: ${to.fullPath}`
      })])
    } else if (process.server) {
      const currentURL = to.fullPath || '/'
      if (!isEqual(currentURL, initialURL)) {
        await callWithNuxt(nuxtApp, navigateTo, [currentURL])
      }
    }
  })

  nuxtApp.hooks.hookOnce('app:created', async () => {
    try {
      await router.replace({
        ...router.resolve(initialURL),
        name: undefined, // #4920, #$4982
        force: true
      })
    } catch (error: any) {
      // We'll catch middleware errors or deliberate exceptions here
      callWithNuxt(nuxtApp, showError, [error])
    }
  })

  return { provide: { router } }
})
