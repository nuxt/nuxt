import { isReadonly, reactive, shallowReactive, shallowRef } from 'vue'
import type { Ref } from 'vue'
import type { RouteLocationNormalizedLoadedGeneric, Router, RouterScrollBehavior } from 'vue-router'
import { START_LOCATION, createMemoryHistory, createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { isSamePath, withoutBase } from 'ufo'

import type { NuxtApp, Plugin, RouteMiddleware } from 'nuxt/app'
import type { PageMeta } from '../composables'

import { toArray } from '../utils'

import { getRouteRules } from '#app/composables/manifest'
import { defineNuxtPlugin, useRuntimeConfig } from '#app/nuxt'
import { clearError, createError, isNuxtError, showError, useError } from '#app/composables/error'
import { navigateTo } from '#app/composables/router'
import type { MaskedHistoryState } from '#app/composables/router'

import _routes, { handleHotUpdate } from '#build/routes'
import routerOptions, { defaultUnmaskOnReload, hashMode } from '#build/router.options.mjs'
// @ts-expect-error virtual file
import { globalMiddleware, namedMiddleware } from '#build/middleware'

// Stores mask state to restore after router initialization (when not unmasking on reload)
let pendingMaskState: MaskedHistoryState | null = null

/**
 * Get the initial route URL, accounting for masked routes.
 * On client-side, checks history.state for a masked route (__tempLocation).
 * If unmaskOnReload is true, clears the mask and returns the real URL.
 */
function getInitialURL (
  base: string,
  location: Location,
  renderedPath?: string,
): string {
  // Check for masked route state on client
  if (import.meta.client) {
    const state = window.history.state as MaskedHistoryState | null

    if (state?.__tempLocation) {
      // Check if we should unmask on reload:
      // 1. Explicit __unmaskOnReload in state takes precedence
      // 2. Fall back to global defaultUnmaskOnReload config
      const shouldUnmask = state.__unmaskOnReload ?? defaultUnmaskOnReload
      if (shouldUnmask) {
        window.history.replaceState({}, '', state.__tempLocation)
        return state.__tempLocation
      }

      // Store mask state to restore after router initialization
      // Vue Router will replace history state, so we need to re-apply the mask
      if (state.__maskUrl) {
        pendingMaskState = state
      }

      // Use the real route from state for routing
      return state.__tempLocation
    }
  }

  // Fallback to normal URL resolution
  return createCurrentLocation(base, location, renderedPath)
}

// https://github.com/vuejs/router/blob/4a0cc8b9c1e642cdf47cc007fa5bbebde70afc66/packages/router/src/history/html5.ts#L37
function createCurrentLocation (
  base: string,
  location: Location,
  renderedPath?: string,
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
  const displayedPath = withoutBase(pathname, base)
  const path = !renderedPath || isSamePath(displayedPath, renderedPath) ? displayedPath : renderedPath
  return path + (path.includes('?') ? '' : search) + hash
}

const plugin: Plugin<{ router: Router }> = defineNuxtPlugin({
  name: 'nuxt:router',
  enforce: 'pre',
  async setup (nuxtApp) {
    let routerBase = useRuntimeConfig().app.baseURL
    if (hashMode && !routerBase.includes('#')) {
      // allow the user to provide a `#` in the middle: `/base/#/app`
      routerBase += '#'
    }

    const history = routerOptions.history?.(routerBase) ?? (import.meta.client
      ? (hashMode ? createWebHashHistory(routerBase) : createWebHistory(routerBase))
      : createMemoryHistory(routerBase)
    )

    const routes = routerOptions.routes ? await routerOptions.routes(_routes) ?? _routes : _routes

    let startPosition: Parameters<RouterScrollBehavior>[2] | null

    const router = createRouter({
      ...routerOptions,
      scrollBehavior: (to, from, savedPosition) => {
        if (from === START_LOCATION) {
          startPosition = savedPosition
          return
        }
        if (routerOptions.scrollBehavior) {
          // reset scroll behavior to initial value
          router.options.scrollBehavior = routerOptions.scrollBehavior
          if ('scrollRestoration' in window.history) {
            const unsub = router.beforeEach(() => {
              unsub()
              window.history.scrollRestoration = 'manual'
            })
          }
          return routerOptions.scrollBehavior(to, START_LOCATION, startPosition || savedPosition)
        }
      },
      history,
      routes,
    })

    if (import.meta.hot) {
      handleHotUpdate(router, routerOptions.routes ? routerOptions.routes : routes => routes)
    }

    if (import.meta.client && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'auto'
    }
    nuxtApp.vueApp.use(router)

    // Handle popstate for masked routes
    // When navigating back/forward, check if the restored state has a masked route
    if (import.meta.client) {
      window.addEventListener('popstate', () => {
        const state = window.history.state as MaskedHistoryState | null
        if (state?.__tempLocation) {
          // Navigate to the real route stored in state
          // Use replace to avoid adding another history entry
          const currentPath = router.currentRoute.value.fullPath
          if (!isSamePath(currentPath, state.__tempLocation)) {
            router.replace(state.__tempLocation)
          }
        }
      })
    }

    const previousRoute = shallowRef(router.currentRoute.value)
    router.afterEach((_to, from) => {
      previousRoute.value = from
    })

    // Handle definePageMeta mask
    if (import.meta.client) {
      router.afterEach((to, _from, failure) => {
        // Don't apply mask if navigation failed
        if (failure) { return }

        // Don't apply mask if we're already in a masked state (from navigateTo)
        const currentState = window.history.state as MaskedHistoryState | null
        if (currentState?.__tempLocation) { return }

        // Check if the route has a mask defined in meta
        const maskMeta = to.meta.mask
        if (!maskMeta) { return }

        // Resolve the mask URL
        const maskUrl = typeof maskMeta === 'function' ? maskMeta(to) : maskMeta
        if (!maskUrl || maskUrl === to.fullPath) { return }

        // Apply the mask
        // Use explicit meta.unmaskOnReload if set, otherwise fall back to global default
        const shouldUnmaskOnReload = to.meta.unmaskOnReload ?? defaultUnmaskOnReload
        const state: MaskedHistoryState = {
          __tempLocation: to.fullPath,
          __maskUrl: maskUrl,
          // Always store the resolved value so explicit false overrides global default
          __unmaskOnReload: shouldUnmaskOnReload,
        }
        window.history.replaceState(state, '', maskUrl)
      })
    }

    Object.defineProperty(nuxtApp.vueApp.config.globalProperties, 'previousRoute', {
      get: () => previousRoute.value,
    })

    const initialURL = import.meta.server
      ? nuxtApp.ssrContext!.url
      : getInitialURL(routerBase, window.location, nuxtApp.payload.path)

    // Allows suspending the route object until page navigation completes
    const _route = shallowRef(router.currentRoute.value)
    const syncCurrentRoute = () => { _route.value = router.currentRoute.value }
    router.afterEach((to, from) => {
      // We won't trigger suspense if the component is reused between routes
      // so we need to update the route manually
      if (to.matched.at(-1)?.components?.default === from.matched.at(-1)?.components?.default) {
        syncCurrentRoute()
      }
    })

    // https://github.com/vuejs/router/blob/8487c3e18882a0883e464a0f25fb28fa50eeda38/packages/router/src/router.ts#L1283-L1289
    const route = { sync: syncCurrentRoute } as NuxtApp['_route']
    for (const key in _route.value) {
      Object.defineProperty(route, key, {
        get: () => _route.value[key as keyof RouteLocationNormalizedLoadedGeneric],
        enumerable: true,
      })
    }

    nuxtApp._route = shallowReactive(route)

    nuxtApp._middleware ||= {
      global: [],
      named: {},
    }

    const error = useError()
    if (import.meta.client || !nuxtApp.ssrContext?.islandContext) {
      router.afterEach(async (to, _from, failure) => {
        delete nuxtApp._processingMiddleware

        if (import.meta.client && !nuxtApp.isHydrating && error.value) {
          // Clear any existing errors
          await nuxtApp.runWithContext(clearError)
        }
        if (failure) {
          await nuxtApp.callHook('page:loading:end')
        }
        if (import.meta.server && failure?.type === 4 /* ErrorTypes.NAVIGATION_ABORTED */) {
          return
        }

        if (import.meta.server && to.redirectedFrom && to.fullPath !== initialURL) {
          await nuxtApp.runWithContext(() => navigateTo(to.fullPath || '/'))
        }
      })
    }

    try {
      if (import.meta.server) {
        await router.push(initialURL)
      }
      await router.isReady()
    } catch (error: any) {
      // We'll catch 404s here
      await nuxtApp.runWithContext(() => showError(error))
    }

    const resolvedInitialRoute = import.meta.client && initialURL !== router.currentRoute.value.fullPath
      ? router.resolve(initialURL)
      : router.currentRoute.value
    syncCurrentRoute()

    if (import.meta.server && nuxtApp.ssrContext?.islandContext) {
      // We're in an island context, and don't need to handle middleware or redirections
      return { provide: { router } }
    }

    const initialLayout = nuxtApp.payload.state._layout
    router.beforeEach(async (to, from) => {
      await nuxtApp.callHook('page:loading:start')
      to.meta = reactive(to.meta)
      if (nuxtApp.isHydrating && initialLayout && !isReadonly(to.meta.layout)) {
        to.meta.layout = initialLayout as Exclude<PageMeta['layout'], Ref | false>
      }
      nuxtApp._processingMiddleware = true

      if (import.meta.client || !nuxtApp.ssrContext?.islandContext) {
        type MiddlewareDef = string | RouteMiddleware
        const middlewareEntries = new Set<MiddlewareDef>([...globalMiddleware, ...nuxtApp._middleware.global])
        for (const component of to.matched) {
          const componentMiddleware = component.meta.middleware as MiddlewareDef | MiddlewareDef[]
          if (!componentMiddleware) { continue }
          for (const entry of toArray(componentMiddleware)) {
            middlewareEntries.add(entry)
          }
        }

        const routeRules = getRouteRules({ path: to.path })

        if (routeRules.appMiddleware) {
          for (const key in routeRules.appMiddleware) {
            if (routeRules.appMiddleware[key]) {
              middlewareEntries.add(key)
            } else {
              middlewareEntries.delete(key)
            }
          }
        }

        for (const entry of middlewareEntries) {
          const middleware: RouteMiddleware = typeof entry === 'string' ? nuxtApp._middleware.named[entry] || await namedMiddleware[entry]?.().then((r: any) => r.default || r) : entry

          if (!middleware) {
            if (import.meta.dev) {
              throw new Error(`Unknown route middleware: '${entry}'. Valid middleware: ${Object.keys(namedMiddleware).map(mw => `'${mw}'`).join(', ')}.`)
            }
            throw new Error(`Unknown route middleware: '${entry}'.`)
          }

          try {
            if (import.meta.dev) {
              nuxtApp._processingMiddleware = (middleware as any)._path || (typeof entry === 'string' ? entry : true)
            }
            const result = await nuxtApp.runWithContext(() => middleware(to, from))
            if (import.meta.server || (!nuxtApp.payload.serverRendered && nuxtApp.isHydrating)) {
              if (result === false || result instanceof Error) {
                const error = result || createError({
                  status: 404,
                  statusText: `Page Not Found: ${initialURL}`,
                })
                await nuxtApp.runWithContext(() => showError(error))
                return false
              }
            }

            if (result === true) { continue }
            if (result === false) {
              return result
            }
            if (result) {
              if (isNuxtError(result) && result.fatal) {
                await nuxtApp.runWithContext(() => showError(result))
              }
              return result
            }
          } catch (err: any) {
            const error = createError(err)
            if (error.fatal) {
              await nuxtApp.runWithContext(() => showError(error))
            }
            return error
          }
        }
      }
    })

    router.onError(async () => {
      delete nuxtApp._processingMiddleware
      await nuxtApp.callHook('page:loading:end')
    })

    router.afterEach((to) => {
      if (to.matched.length === 0) {
        return nuxtApp.runWithContext(() => showError(createError({
          status: 404,
          fatal: false,
          statusText: `Page not found: ${to.fullPath}`,
          data: {
            path: to.fullPath,
          },
        })))
      }
    })

    nuxtApp.hooks.hookOnce('app:created', async () => {
      try {
        // #4920, #4982
        if ('name' in resolvedInitialRoute) {
          resolvedInitialRoute.name = undefined
        }
        await router.replace({
          ...resolvedInitialRoute,
          force: true,
        })
        // reset scroll behavior to initial value
        router.options.scrollBehavior = routerOptions.scrollBehavior

        // Restore mask state after router initialization (for reload with unmaskOnReload: false)
        if (import.meta.client && pendingMaskState) {
          window.history.replaceState(pendingMaskState, '', pendingMaskState.__maskUrl)
          pendingMaskState = null
        }
      } catch (error: any) {
        // We'll catch middleware errors or deliberate exceptions here
        await nuxtApp.runWithContext(() => showError(error))
      }
    })

    return { provide: { router } }
  },
})

export default plugin
