import { KeepAliveProps, TransitionProps, UnwrapRef } from 'vue'
import type { Router, RouteLocationNormalizedLoaded, NavigationGuard, RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { useNuxtApp } from '#app'

export const useRouter = () => {
  return useNuxtApp().$router as Router
}

export const useRoute = () => {
  return useNuxtApp()._route as RouteLocationNormalizedLoaded
}

export interface PageMeta {
  [key: string]: any
  pageTransition?: false | TransitionProps
  layoutTransition?: false | TransitionProps
  key?: string | ((route: RouteLocationNormalizedLoaded) => string)
  keepalive?: false | KeepAliveProps
}

declare module 'vue-router' {
  interface RouteMeta extends UnwrapRef<PageMeta> {}
}

const warnRuntimeUsage = (method: string) =>
  console.warn(
    `${method}() is a compiler-hint helper that is only usable inside ` +
      '<script setup> of a single file component. Its arguments should be ' +
      'compiled away and passing it at runtime has no effect.'
  )

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const definePageMeta = (meta: PageMeta): void => {
  if (process.dev) {
    warnRuntimeUsage('definePageMeta')
  }
}

export interface RouteMiddleware {
  (to: RouteLocationNormalized, from: RouteLocationNormalized): ReturnType<NavigationGuard>
}

export const defineNuxtRouteMiddleware = (middleware: RouteMiddleware) => middleware

export interface AddRouteMiddlewareOptions {
  global?: boolean
}

export const addRouteMiddleware = (name: string, middleware: RouteMiddleware, options: AddRouteMiddlewareOptions = {}) => {
  const nuxtApp = useNuxtApp()
  if (options.global) {
    nuxtApp._middleware.global.push(middleware)
  } else {
    nuxtApp._middleware.named[name] = middleware
  }
}

const isProcessingMiddleware = () => {
  try {
    if (useNuxtApp()._processingMiddleware) {
      return true
    }
  } catch {}
  return false
}

export const navigateTo = (to: RouteLocationRaw) => {
  if (isProcessingMiddleware()) {
    return to
  }
  const router: Router = process.server ? useRouter() : (window as any).$nuxt.router
  return router.push(to)
}

/** This will abort navigation within a Nuxt route middleware handler. */
export const abortNavigation = (err?: Error | string) => {
  if (process.dev && !isProcessingMiddleware()) {
    throw new Error('abortNavigation() is only usable inside a route middleware handler.')
  }
  if (err) {
    throw err instanceof Error ? err : new Error(err)
  }
  return false
}
