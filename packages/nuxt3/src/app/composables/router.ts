import type { Router, RouteLocationNormalizedLoaded, NavigationGuard, RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { useNuxtApp } from '#app'

export const useRouter = () => {
  return useNuxtApp()?.$router as Router
}

export const useRoute = () => {
  return useNuxtApp()._route as RouteLocationNormalizedLoaded
}

export interface RouteMiddleware {
  (to: RouteLocationNormalized, from: RouteLocationNormalized): ReturnType<NavigationGuard>
}

export const defineNuxtRouteMiddleware = (middleware: RouteMiddleware) => middleware

export interface AddRouteMiddlewareOptions {
  global?: boolean
}

interface AddRouteMiddleware {
  (name: string, middleware: RouteMiddleware, options?: AddRouteMiddlewareOptions): void
  (middleware: RouteMiddleware): void
}

export const addRouteMiddleware: AddRouteMiddleware = (name: string | RouteMiddleware, middleware?: RouteMiddleware, options: AddRouteMiddlewareOptions = {}) => {
  const nuxtApp = useNuxtApp()
  if (options.global || typeof name === 'function') {
    nuxtApp._middleware.global.push(typeof name === 'function' ? name : middleware)
  } else {
    nuxtApp._middleware.named[name] = middleware
  }
}

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

export const navigateTo = (to: RouteLocationRaw) => {
  if (isProcessingMiddleware()) {
    return to
  }
  const router: Router = process.server ? useRouter() : (window as any).$nuxt.$router
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
