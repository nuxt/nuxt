import { computed, reactive, shallowRef } from 'vue'
import {
  createRouter,
  createWebHistory,
  createMemoryHistory,
  NavigationGuard
} from 'vue-router'
import { createError } from 'h3'
import NuxtPage from './page'
import { callWithNuxt, defineNuxtPlugin, useRuntimeConfig, NuxtApp, throwError, clearError } from '#app'
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

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('NuxtPage', NuxtPage)
  // TODO: remove before release - present for backwards compatibility & intentionally undocumented
  nuxtApp.vueApp.component('NuxtNestedPage', NuxtPage)
  nuxtApp.vueApp.component('NuxtChild', NuxtPage)

  const { baseURL } = useRuntimeConfig().app
  const routerHistory = process.client
    ? createWebHistory(baseURL)
    : createMemoryHistory(baseURL)

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

  nuxtApp._route = reactive(route)

  nuxtApp._middleware = nuxtApp._middleware || {
    global: [],
    named: {}
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

    if (process.client && !nuxtApp.isHydrating) {
      // Clear any existing errors
      await callWithNuxt(nuxtApp as NuxtApp, clearError)
    }

    for (const entry of middlewareEntries) {
      const middleware = typeof entry === 'string' ? nuxtApp._middleware.named[entry] || await namedMiddleware[entry]?.().then(r => r.default || r) : entry

      if (process.dev && !middleware) {
        console.warn(`Unknown middleware: ${entry}. Valid options are ${Object.keys(namedMiddleware).join(', ')}.`)
      }

      const result = await callWithNuxt(nuxtApp as NuxtApp, middleware, [to, from])
      if (process.server) {
        if (result === false || result instanceof Error) {
          const error = result || createError({
            statusMessage: `Route navigation aborted: ${nuxtApp.ssrContext.url}`
          })
          return callWithNuxt(nuxtApp, throwError, [error])
        }
      }
      if (result || result === false) { return result }
    }
  })

  router.afterEach(() => {
    delete nuxtApp._processingMiddleware
  })

  nuxtApp.hook('app:created', async () => {
    router.afterEach((to) => {
      if (to.matched.length === 0) {
        callWithNuxt(nuxtApp, throwError, [createError({
          statusCode: 404,
          statusMessage: `Page not found: ${to.fullPath}`
        })])
      }
    })

    if (process.server) {
      router.push(nuxtApp.ssrContext.url)

      router.afterEach((to) => {
        if (to.fullPath !== nuxtApp.ssrContext.url) {
          nuxtApp.ssrContext.res.setHeader('Location', to.fullPath)
          nuxtApp.ssrContext.res.statusCode = 301
          nuxtApp.ssrContext.res.end()
        }
      })
    }

    try {
      await router.isReady()
    } catch (error) {
      callWithNuxt(nuxtApp, throwError, [error])
    }
  })

  return { provide: { router } }
})
