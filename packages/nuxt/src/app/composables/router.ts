import { getCurrentInstance, hasInjectionContext, inject, onScopeDispose } from 'vue'
import type { Ref } from 'vue'
import type { NavigationFailure, NavigationGuard, RouteLocationNormalized, RouteLocationPathRaw, RouteLocationRaw, Router, useRoute as _useRoute, useRouter as _useRouter } from '#vue-router'
import type { NuxtAppConfig } from 'nuxt/schema'

import { sanitizeStatusCode } from 'h3'
import { hasProtocol, isScriptProtocol, joinURL, parseURL, withTrailingSlash, withoutTrailingSlash } from 'ufo'

// eslint-disable-next-line import/no-restricted-paths
import type { PageMeta } from '../../pages/runtime/composables'

import { useNuxtApp, useRuntimeConfig } from '../nuxt'
import { PageRouteSymbol } from '../components/injections'
import type { NuxtError } from './error'
import { createError, showError } from './error'

// @ts-expect-error virtual file
import { appTrailingSlash } from '#build/nuxt.config.mjs'

/** @since 3.0.0 */
export const useRouter: typeof _useRouter = () => {
  return useNuxtApp()?.$router as Router
}

/** @since 3.0.0 */
export const useRoute: typeof _useRoute = () => {
  if (import.meta.dev && isProcessingMiddleware()) {
    console.warn('[nuxt] Calling `useRoute` within middleware may lead to misleading results. Instead, use the (to, from) arguments passed to the middleware to access the new and old routes.')
  }
  if (hasInjectionContext()) {
    return inject(PageRouteSymbol, useNuxtApp()._route)
  }
  return useNuxtApp()._route
}

/** @since 3.0.0 */
export const onBeforeRouteLeave = (guard: NavigationGuard) => {
  const unsubscribe = useRouter().beforeEach((to, from, next) => {
    if (to === from) { return }
    return guard(to, from, next)
  })
  onScopeDispose(unsubscribe)
}

export const createRouteResolver = (options: {
    trailingSlash?: NuxtAppConfig['trailingSlash'],
} = {}): (to: RouteLocationRaw, options?: { external?: boolean }) => string => {
  options.trailingSlash = options.trailingSlash || appTrailingSlash
  const router = useRouter()
  let normalizeSlashesFn: (input: string, respectQueryAndFragment: boolean) => string = (i) => i
  if (options.trailingSlash === 'append')
    normalizeSlashesFn = withTrailingSlash
  else if (options.trailingSlash === 'remove')
    normalizeSlashesFn = withoutTrailingSlash
  return (to: RouteLocationRaw, options?: { external?: boolean }) => {
    const path = typeof to === 'object' && 'path' in to ? to.path : router.resolve(to).fullPath

    const isFile = withoutTrailingSlash(path.split('/').pop())?.includes('.')
    // Until https://github.com/unjs/ufo/issues/189 is resolved
    const hasProtocolDifferentFromHttp = hasProtocol(path) && !path.startsWith('http')
    if (isFile || hasProtocolDifferentFromHttp  || options?.external) {
      return path
    }

    return joinURL(useRuntimeConfig().app.baseURL, normalizeSlashesFn(path, true))
  }
}

/** @since 3.0.0 */
export const onBeforeRouteUpdate = (guard: NavigationGuard) => {
  const unsubscribe = useRouter().beforeEach(guard)
  onScopeDispose(unsubscribe)
}

export interface RouteMiddleware {
  (to: RouteLocationNormalized, from: RouteLocationNormalized): ReturnType<NavigationGuard>
}

/** @since 3.0.0 */
/*@__NO_SIDE_EFFECTS__*/
export function defineNuxtRouteMiddleware (middleware: RouteMiddleware) {
  return middleware
}

export interface AddRouteMiddlewareOptions {
  global?: boolean
}

interface AddRouteMiddleware {
  (name: string, middleware: RouteMiddleware, options?: AddRouteMiddlewareOptions): void
  (middleware: RouteMiddleware): void
}

/** @since 3.0.0 */
export const addRouteMiddleware: AddRouteMiddleware = (name: string | RouteMiddleware, middleware?: RouteMiddleware, options: AddRouteMiddlewareOptions = {}) => {
  const nuxtApp = useNuxtApp()
  const global = options.global || typeof name !== 'string'
  const mw = typeof name !== 'string' ? name : middleware
  if (!mw) {
    console.warn('[nuxt] No route middleware passed to `addRouteMiddleware`.', name)
    return
  }
  if (global) {
    nuxtApp._middleware.global.push(mw)
  } else {
    nuxtApp._middleware.named[name] = mw
  }
}

/** @since 3.0.0 */
const isProcessingMiddleware = () => {
  try {
    if (useNuxtApp()._processingMiddleware) {
      return true
    }
  } catch {
    // Within an async middleware
    return true
  }
  return false
}

// Conditional types, either one or other
type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never }
type XOR<T, U> = (T | U) extends Object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U

export type OpenWindowFeatures = {
  popup?: boolean
  noopener?: boolean
  noreferrer?: boolean
} & XOR<{width?: number}, {innerWidth?: number}>
  & XOR<{height?: number}, {innerHeight?: number}>
  & XOR<{left?: number}, {screenX?: number}>
  & XOR<{top?: number}, {screenY?: number}>

export type OpenOptions = {
  target: '_blank' | '_parent' | '_self' | '_top' | (string & {})
  windowFeatures?: OpenWindowFeatures
}

export interface NavigateToOptions {
  replace?: boolean
  redirectCode?: number
  external?: boolean
  open?: OpenOptions
}

/** @since 3.0.0 */
export const navigateTo = (to: RouteLocationRaw | undefined | null, options?: NavigateToOptions): Promise<void | NavigationFailure | false> | false | void | RouteLocationRaw => {
  // normalise to a RouteLocationNamedRaw
  const _route = (typeof to === 'string' ? { path: to || '/' } : to || '/') as RouteLocationPathRaw
  const isExternal = options?.external || hasProtocol(_route.path, { acceptRelative: true })
  const resolveRoute = createRouteResolver()
  const path = resolveRoute(_route, {
    external: isExternal,
  })
  const route: RouteLocationRaw = {
    ..._route,
    name: undefined,
    path,
  }

  // Early open handler
  if (options?.open) {
    if (import.meta.client) {
      const { target = '_blank', windowFeatures = {} } = options.open

      const features = Object.entries(windowFeatures)
        .filter(([_, value]) => value !== undefined)
        .map(([feature, value]) => `${feature.toLowerCase()}=${value}`)
        .join(', ')

      open(path, target, features)
    }

    return Promise.resolve()
  }

  if (isExternal) {
    if (!options?.external) {
      throw new Error('Navigating to an external URL is not allowed by default. Use `navigateTo(url, { external: true })`.')
    }
    const protocol = parseURL(path).protocol
    if (protocol && isScriptProtocol(protocol)) {
      throw new Error(`Cannot navigate to a URL with '${protocol}' protocol.`)
    }
  }


  const inMiddleware = isProcessingMiddleware()

  // Early redirect on client-side
  if (import.meta.client && !isExternal && inMiddleware) {
    return route
  }

  const router = useRouter()

  const nuxtApp = useNuxtApp()

  if (import.meta.server) {
    if (nuxtApp.ssrContext) {
      const redirect = async function (response: any) {
        // TODO: consider deprecating in favour of `app:rendered` and removing
        await nuxtApp.callHook('app:redirected')
        const encodedLoc = path.replace(/"/g, '%22')
        nuxtApp.ssrContext!._renderResponse = {
          statusCode: sanitizeStatusCode(options?.redirectCode || 302, 302),
          body: `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${encodedLoc}"></head></html>`,
          headers: { location: path }
        }
        return response
      }

      // We wait to perform the redirect last in case any other middleware will intercept the redirect
      // and redirect somewhere else instead.
      if (!isExternal && inMiddleware) {
        router.afterEach(final => final.fullPath === path ? redirect(false) : undefined)
        return route
      }
      return redirect(!inMiddleware ? undefined : /* abort route navigation */ false)
    }
  }

  // Client-side redirection using vue-router
  if (isExternal) {
    // Run any cleanup steps for the current scope, like ending BroadcastChannel
    nuxtApp._scope.stop()
    if (options?.replace) {
      location.replace(path)
    } else {
      location.href = path
    }
    // Within in a Nuxt route middleware handler
    if (inMiddleware) {
      // Abort navigation when app is hydrated
      if (!nuxtApp.isHydrating) {
        return false
      }
      // When app is hydrating (i.e. on page load), we don't want to abort navigation as
      // it would lead to a 404 error / page that's blinking before location changes.
      return new Promise(() => {})
    }
    return Promise.resolve()
  }

  return options?.replace ? router.replace(route) : router.push(route)
}

/**
 * This will abort navigation within a Nuxt route middleware handler.
 * @since 3.0.0
 */
export const abortNavigation = (err?: string | Partial<NuxtError>) => {
  if (import.meta.dev && !isProcessingMiddleware()) {
    throw new Error('abortNavigation() is only usable inside a route middleware handler.')
  }

  if (!err) { return false }

  err = createError(err)

  if (err.fatal) {
    useNuxtApp().runWithContext(() => showError(err as NuxtError))
  }

  throw err
}

/** @since 3.0.0 */
export const setPageLayout = (layout: unknown extends PageMeta['layout'] ? string : PageMeta['layout']) => {
  const nuxtApp = useNuxtApp()
  if (import.meta.server) {
    if (import.meta.dev && getCurrentInstance() && nuxtApp.payload.state._layout !== layout) {
      console.warn('[warn] [nuxt] `setPageLayout` should not be called to change the layout on the server within a component as this will cause hydration errors.')
    }
    nuxtApp.payload.state._layout = layout
  }
  if (import.meta.dev && nuxtApp.isHydrating && nuxtApp.payload.serverRendered && nuxtApp.payload.state._layout !== layout) {
    console.warn('[warn] [nuxt] `setPageLayout` should not be called to change the layout during hydration as this will cause hydration errors.')
  }
  const inMiddleware = isProcessingMiddleware()
  if (inMiddleware || import.meta.server || nuxtApp.isHydrating) {
    const unsubscribe = useRouter().beforeResolve((to) => {
      to.meta.layout = layout as Exclude<PageMeta['layout'], Ref | false>
      unsubscribe()
    })
  }
  if (!inMiddleware) {
    useRoute().meta.layout = layout as Exclude<PageMeta['layout'], Ref | false>
  }
}
