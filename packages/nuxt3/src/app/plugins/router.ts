import { DefineComponent, reactive, h } from 'vue'
import { parseURL, parseQuery } from 'ufo'
import { NuxtApp } from '@nuxt/schema'
import { createError } from 'h3'
import { defineNuxtPlugin } from '..'
import { callWithNuxt } from '../nuxt'

declare module 'vue' {
  export interface GlobalComponents {
    NuxtLink: DefineComponent<{ to: String }>
  }
}

interface Route {
    /** Percentage encoded pathname section of the URL. */
    path: string;
    /** The whole location including the `search` and `hash`. */
    fullPath: string;
    /** Object representation of the `search` property of the current location. */
    query: Record<string, any>;
    /** Hash of the current location. If present, starts with a `#`. */
    hash: string;
    /** Name of the matched record */
    name: string | null | undefined;
    /** Object of decoded params extracted from the `path`. */
    params: Record<string, any>;
    /**
     * The location we were initially trying to access before ending up
     * on the current location.
     */
    redirectedFrom: Route | undefined;
    /** Merged `meta` properties from all of the matched route records. */
    meta: Record<string, any>;
}

function getRouteFromPath (fullPath: string) {
  const url = parseURL(fullPath.toString())
  return {
    path: url.pathname,
    fullPath,
    query: parseQuery(url.search),
    hash: url.hash,
    // stub properties for compat with vue-router
    params: {},
    name: undefined,
    matched: [],
    redirectedFrom: undefined,
    meta: {}
  }
}

type RouteGuardReturn = void | Error | string | false

interface RouteGuard {
  (to: Route, from: Route): RouteGuardReturn | Promise<RouteGuardReturn>
}

interface RouterHooks {
  'resolve:before': (to: Route, from: Route) => RouteGuardReturn | Promise<RouteGuardReturn>
  'navigate:before': (to: Route, from: Route) => RouteGuardReturn | Promise<RouteGuardReturn>
  'navigate:after': (to: Route, from: Route) => void | Promise<void>
  'error': (err: any) => void | Promise<void>
}

interface Router {
  currentRoute: Route
  isReady: () => Promise<void>
  options: {}
  install: () => Promise<void>
  // Navigation
  push: (url: string) => Promise<void>
  replace: (url: string) => Promise<void>
  back: () => void
  go: (delta: number) => void
  forward: () => void
  // Guards
  beforeResolve: (guard: RouterHooks['resolve:before']) => () => void
  beforeEach: (guard: RouterHooks['navigate:before']) => () => void
  afterEach: (guard: RouterHooks['navigate:after']) => () => void
  onError: (handler: RouterHooks['error']) => () => void
  // Routes
  resolve: (url: string) => Route
  addRoute: (parentName: string, route: Route) => void
  getRoutes: () => any[]
  hasRoute: (name: string) => boolean
  removeRoute: (name: string) => void
}

export default defineNuxtPlugin<{ route: Route, router: Router }>((nuxtApp) => {
  const routes = []

  const hooks: { [key in keyof RouterHooks]: RouterHooks[key][] } = {
    'navigate:before': [],
    'resolve:before': [],
    'navigate:after': [],
    error: []
  }

  const registerHook = <T extends keyof RouterHooks>(hook: T, guard: RouterHooks[T]) => {
    hooks[hook].push(guard)
    return () => hooks[hook].splice(hooks[hook].indexOf(guard), 1)
  }

  const route: Route = reactive(getRouteFromPath(process.client ? window.location.href : nuxtApp.ssrContext.url))
  async function handleNavigation (url: string, replace?: boolean): Promise<void> {
    if (process.dev && process.client && !hooks.error.length) {
      console.warn('No error handlers registered to handle middleware errors. You can register an error handler with `router.onError()`')
    }
    try {
      // Resolve route
      const to = getRouteFromPath(url)
      // Run beforeEach hooks
      for (const middleware of hooks['navigate:before']) {
        const result = await middleware(to, route)
        // Cancel navigation
        if (result === false || result instanceof Error) { return }
        // Redirect
        if (result) { return handleNavigation(result, true) }
      }

      for (const handler of hooks['resolve:before']) {
        await handler(to, route)
      }
      // Perform navigation
      Object.assign(route, to)
      if (process.client) {
        window.history[replace ? 'replaceState' : 'pushState']({}, '', url)
      }
      // Run afterEach hooks
      for (const middleware of hooks['navigate:after']) {
        await middleware(to, route)
      }
    } catch (err) {
      for (const handler of hooks.error) {
        await handler(err)
      }
    }
  }

  const router: Router = {
    currentRoute: route,
    isReady: () => Promise.resolve(),
    //
    options: {},
    install: () => Promise.resolve(),
    // Navigation
    push: (url: string) => handleNavigation(url, false),
    replace: (url: string) => handleNavigation(url, true),
    back: () => window.history.go(-1),
    go: (delta: number) => window.history.go(delta),
    forward: () => window.history.go(1),
    // Guards
    beforeResolve: (guard: RouterHooks['resolve:before']) => registerHook('resolve:before', guard),
    beforeEach: (guard: RouterHooks['navigate:before']) => registerHook('navigate:before', guard),
    afterEach: (guard: RouterHooks['navigate:after']) => registerHook('navigate:after', guard),
    onError: (handler: RouterHooks['error']) => registerHook('error', handler),
    // Routes
    resolve: getRouteFromPath,
    addRoute: (parentName: string, route: Route) => { routes.push(route) },
    getRoutes: () => routes,
    hasRoute: (name: string) => routes.some(route => route.name === name),
    removeRoute: (name: string) => {
      const index = routes.findIndex(route => route.name === name)
      if (index !== -1) {
        routes.splice(index, 1)
      }
    }
  }

  if (process.client) {
    window.addEventListener('popstate', (event) => {
      const location = (event.target as Window).location
      router.replace(location.href.replace(location.origin, ''))
    })
  }

  nuxtApp._route = route

  // Handle middleware
  nuxtApp._middleware = nuxtApp._middleware || {
    global: [],
    named: {}
  }

  router.beforeEach(async (to, from) => {
    to.meta = reactive(to.meta || {})
    nuxtApp._processingMiddleware = true

    type MiddlewareDef = string | RouteGuard
    const middlewareEntries = new Set<MiddlewareDef>(nuxtApp._middleware.global)

    for (const middleware of middlewareEntries) {
      const result = await callWithNuxt(nuxtApp as NuxtApp, middleware, [to, from])
      if (process.server) {
        if (result === false || result instanceof Error) {
          const error = result || createError({
            statusMessage: `Route navigation aborted: ${nuxtApp.ssrContext.url}`
          })
          nuxtApp.ssrContext.error = error
          throw error
        }
      }
      if (result || result === false) { return result }
    }
  })

  router.afterEach(() => {
    delete nuxtApp._processingMiddleware
  })

  nuxtApp.vueApp.component('NuxtLink', {
    functional: true,
    props: { to: String },
    setup: (props, { slots }) => () => h('a', { href: props.to, onClick: (e) => { e.preventDefault(); router.push(props.to) } }, slots)
  })

  if (process.server) {
    nuxtApp.hooks.hookOnce('app:created', async () => {
      await router.push(nuxtApp.ssrContext.url)
      if (route.fullPath !== nuxtApp.ssrContext.url) {
        nuxtApp.ssrContext.res.setHeader('Location', route.fullPath)
        nuxtApp.ssrContext.res.statusCode = 301
        nuxtApp.ssrContext.res.end()
      }
    })
  }

  return {
    provide: {
      route,
      router
    }
  }
})
