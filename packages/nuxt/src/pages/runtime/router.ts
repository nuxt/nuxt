import { computed, reactive, shallowRef } from 'vue'
import {
  createRouter,
  createWebHistory,
  createMemoryHistory,
  NavigationGuard,
  RouteLocation
} from 'vue-router'
import { createError } from 'h3'
import { withoutBase, isEqual } from 'ufo'
import NuxtPage from './page'
import { callWithNuxt, defineNuxtPlugin, useRuntimeConfig, throwError, clearError, navigateTo, useError } from '#app'
// @ts-ignore
import routes from '#build/routes'
// @ts-ignore
import routerOptions from '#build/router.options'
// @ts-ignore
import { globalMiddleware, namedMiddleware } from '#build/middleware'

declare module 'vue' {
  export interface GlobalComponents {
    NuxtPage: typeof NuxtPage
    /** @deprecated */
    NuxtNestedPage: typeof NuxtPage
    /** @deprecated */
    NuxtChild: typeof NuxtPage
  }
}

// https://github.dev/vuejs/router/blob/main/src/history/html5.ts#L33-L56
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
  nuxtApp.vueApp.component('NuxtPage', NuxtPage)
  // TODO: remove before release - present for backwards compatibility & intentionally undocumented
  nuxtApp.vueApp.component('NuxtNestedPage', NuxtPage)
  nuxtApp.vueApp.component('NuxtChild', NuxtPage)

  const baseURL = useRuntimeConfig().app.baseURL
  const routerHistory = process.client
    ? createWebHistory(baseURL)
    : createMemoryHistory(baseURL)

  const initialURL = process.server ? nuxtApp.ssrContext.url : createCurrentLocation(baseURL, window.location)
  const router = createRouter({
    ...routerOptions,
    history: routerHistory,
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

  // https://github.com/vuejs/vue-router-next/blob/master/src/router.ts#L1192-L1200
  const route = {}
  for (const key in router.currentRoute.value) {
    route[key] = computed(() => router.currentRoute.value[key])
  }

  // Allows suspending the route object until page navigation completes
  const _activeRoute = shallowRef(router.resolve(initialURL) as RouteLocation)
  const syncCurrentRoute = () => { _activeRoute.value = router.currentRoute.value }
  nuxtApp.hook('page:finish', syncCurrentRoute)
  router.afterEach((to, from) => {
    // We won't trigger suspense if the component is reused between routes
    // so we need to update the route manually
    if (to.matched[0]?.components?.default === from.matched[0]?.components?.default) {
      syncCurrentRoute()
    }
  })
  // https://github.com/vuejs/vue-router-next/blob/master/src/router.ts#L1192-L1200
  const activeRoute = {}
  for (const key in _activeRoute.value) {
    activeRoute[key] = computed(() => _activeRoute.value[key])
  }

  nuxtApp._route = reactive(route)
  nuxtApp._activeRoute = reactive(activeRoute)

  nuxtApp._middleware = nuxtApp._middleware || {
    global: [],
    named: {}
  }

  const error = useError()
  router.afterEach(async (to) => {
    if (process.client && !nuxtApp.isHydrating && error.value) {
      // Clear any existing errors
      await callWithNuxt(nuxtApp, clearError)
    }
    if (to.matched.length === 0) {
      callWithNuxt(nuxtApp, throwError, [createError({
        statusCode: 404,
        statusMessage: `Page not found: ${to.fullPath}`
      })])
    } else if (process.server && to.matched[0].name === '404' && nuxtApp.ssrContext) {
      nuxtApp.ssrContext.res.statusCode = 404
    }
  })

  try {
    if (process.server) {
      await router.push(initialURL)
    }

    await router.isReady()
  } catch (error) {
    // We'll catch 404s here
    callWithNuxt(nuxtApp, throwError, [error])
  }

  router.beforeEach(async (to, from) => {
    to.meta = reactive(to.meta)
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
      const middleware = typeof entry === 'string' ? nuxtApp._middleware.named[entry] || await namedMiddleware[entry]?.().then(r => r.default || r) : entry

      if (process.dev && !middleware) {
        console.warn(`Unknown middleware: ${entry}. Valid options are ${Object.keys(namedMiddleware).join(', ')}.`)
      }

      const result = await callWithNuxt(nuxtApp, middleware, [to, from])
      if (process.server) {
        if (result === false || result instanceof Error) {
          const error = result || createError({
            statusMessage: `Route navigation aborted: ${initialURL}`
          })
          return callWithNuxt(nuxtApp, throwError, [error])
        }
      }
      if (result || result === false) { return result }
    }
  })

  router.afterEach(async (to) => {
    delete nuxtApp._processingMiddleware

    if (process.server) {
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
        force: true
      })
    } catch (error) {
      // We'll catch middleware errors or deliberate exceptions here
      callWithNuxt(nuxtApp, throwError, [error])
    }
  })

  return { provide: { router } }
})
