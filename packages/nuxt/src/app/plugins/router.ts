import { reactive, h, isReadonly } from 'vue'
import { parseURL, stringifyParsedURL, parseQuery, stringifyQuery, withoutBase, isEqual, joinURL } from 'ufo'
import { createError } from 'h3'
import { defineNuxtPlugin, clearError, navigateTo, showError, useRuntimeConfig, useState, useRequestEvent } from '..'
import { callWithNuxt } from '../nuxt'
// @ts-ignore
import { globalMiddleware } from '#build/middleware'

interface Route {
  /** Percentage encoded pathname section of the URL. */
  path: string
  /** The whole location including the `search` and `hash`. */
  fullPath: string
  /** Object representation of the `search` property of the current location. */
  query: Record<string, any>
  /** Hash of the current location. If present, starts with a `#`. */
  hash: string
  /** Name of the matched record */
  name: string | null | undefined
  /** Object of decoded params extracted from the `path`. */
  params: Record<string, any>
  /**
   * The location we were initially trying to access before ending up
   * on the current location.
   */
  redirectedFrom: Route | undefined
  /** Merged `meta` properties from all of the matched route records. */
  meta: Record<string, any>
}

function getRouteFromPath (fullPath: string | Partial<Route>) {
  if (typeof fullPath === 'object') {
    fullPath = stringifyParsedURL({
      pathname: fullPath.path || '',
      search: stringifyQuery(fullPath.query || {}),
      hash: fullPath.hash || ''
    })
  }

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
    meta: {},
    href: fullPath
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
  resolve: (url: string | Partial<Route>) => Route
  addRoute: (parentName: string, route: Route) => void
  getRoutes: () => any[]
  hasRoute: (name: string) => boolean
  removeRoute: (name: string) => void
}

export default defineNuxtPlugin<{ route: Route, router: Router }>((nuxtApp) => {
  const initialURL = process.client
    ? withoutBase(window.location.pathname, useRuntimeConfig().app.baseURL) + window.location.search + window.location.hash
    : nuxtApp.ssrContext!.url

  const routes: Route[] = []

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
  const baseURL = useRuntimeConfig().app.baseURL

  const route: Route = reactive(getRouteFromPath(initialURL))
  async function handleNavigation (url: string | Partial<Route>, replace?: boolean): Promise<void> {
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
        window.history[replace ? 'replaceState' : 'pushState']({}, '', joinURL(baseURL, to.fullPath))
        if (!nuxtApp.isHydrating) {
          // Clear any existing errors
          await callWithNuxt(nuxtApp, clearError)
        }
      }
      // Run afterEach hooks
      for (const middleware of hooks['navigate:after']) {
        await middleware(to, route)
      }
    } catch (err) {
      if (process.dev && !hooks.error.length) {
        console.warn('No error handlers registered to handle middleware errors. You can register an error handler with `router.onError()`', err)
      }
      for (const handler of hooks.error) {
        await handler(err)
      }
    }
  }

  const router: Router = {
    currentRoute: route,
    isReady: () => Promise.resolve(),
    // These options provide a similar API to vue-router but have no effect
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

  nuxtApp.vueApp.component('RouterLink', {
    functional: true,
    props: {
      to: String,
      custom: Boolean,
      replace: Boolean,
      // Not implemented
      activeClass: String,
      exactActiveClass: String,
      ariaCurrentValue: String
    },
    setup: (props, { slots }) => {
      const navigate = () => handleNavigation(props.to, props.replace)
      return () => {
        const route = router.resolve(props.to)
        return props.custom
          ? slots.default?.({ href: props.to, navigate, route })
          : h('a', { href: props.to, onClick: (e: MouseEvent) => { e.preventDefault(); return navigate() } }, slots)
      }
    }
  })

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

  const initialLayout = useState('_layout')
  nuxtApp.hooks.hookOnce('app:created', async () => {
    router.beforeEach(async (to, from) => {
      to.meta = reactive(to.meta || {})
      if (nuxtApp.isHydrating && initialLayout.value && !isReadonly(to.meta.layout)) {
        to.meta.layout = initialLayout.value
      }
      nuxtApp._processingMiddleware = true

      const middlewareEntries = new Set<RouteGuard>([...globalMiddleware, ...nuxtApp._middleware.global])

      for (const middleware of middlewareEntries) {
        const result = await callWithNuxt(nuxtApp, middleware, [to, from])
        if (process.server) {
          if (result === false || result instanceof Error) {
            const error = result || createError({
              statusCode: 404,
              statusMessage: `Page Not Found: ${initialURL}`
            })
            return callWithNuxt(nuxtApp, showError, [error])
          }
        }
        if (result || result === false) { return result }
      }
    })

    router.afterEach(() => {
      delete nuxtApp._processingMiddleware
    })

    await router.replace(initialURL)
    if (!isEqual(route.fullPath, initialURL)) {
      const event = await callWithNuxt(nuxtApp, useRequestEvent)
      const options = { redirectCode: event.node.res.statusCode !== 200 ? event.node.res.statusCode || 302 : 302 }
      await callWithNuxt(nuxtApp, navigateTo, [route.fullPath, options])
    }
  })

  return {
    provide: {
      route,
      router
    }
  }
})
