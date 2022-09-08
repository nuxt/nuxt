import { getCurrentInstance, inject } from 'vue'
import type { Router, RouteLocationNormalizedLoaded, NavigationGuard, RouteLocationNormalized, RouteLocationRaw, NavigationFailure, RouteLocationPathRaw } from 'vue-router'
import { sendRedirect } from 'h3'
import { hasProtocol, joinURL, parseURL } from 'ufo'
import { useNuxtApp, useRuntimeConfig, useState, createError, NuxtError } from '#app'

export const useRouter = () => {
  return useNuxtApp()?.$router as Router
}

export const useRoute = (): RouteLocationNormalizedLoaded => {
  if (getCurrentInstance()) {
    return inject('_route', useNuxtApp()._route)
  }
  return useNuxtApp()._route
}

/** @deprecated Use `useRoute` instead. */
export const useActiveRoute = (): RouteLocationNormalizedLoaded => {
  return useNuxtApp()._route
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

export interface NavigateToOptions {
  replace?: boolean
  redirectCode?: number,
  external?: boolean
}

export const navigateTo = (to: RouteLocationRaw | undefined | null, options?: NavigateToOptions): Promise<void | NavigationFailure> | RouteLocationRaw => {
  if (!to) {
    to = '/'
  }

  const toPath = typeof to === 'string' ? to : ((to as RouteLocationPathRaw).path || '/')
  const isExternal = hasProtocol(toPath, true)
  if (isExternal && !options?.external) {
    throw new Error('Navigating to external URL is not allowed by default. Use `nagivateTo (url, { external: true })`.')
  }
  if (isExternal && parseURL(toPath).protocol === 'script:') {
    throw new Error('Cannot navigate to an URL with script protocol.')
  }

  // Early redirect on client-side
  if (!isExternal && isProcessingMiddleware()) {
    return to
  }

  const router = useRouter()

  if (process.server) {
    const nuxtApp = useNuxtApp()
    if (nuxtApp.ssrContext && nuxtApp.ssrContext.event) {
      const redirectLocation = isExternal ? toPath : joinURL(useRuntimeConfig().app.baseURL, router.resolve(to).fullPath || '/')
      return nuxtApp.callHook('app:redirected').then(() => sendRedirect(nuxtApp.ssrContext!.event, redirectLocation, options?.redirectCode || 302))
    }
  }

  // Client-side redirection using vue-router
  if (isExternal) {
    if (options?.replace) {
      location.replace(toPath)
    } else {
      location.href = toPath
    }
    return Promise.resolve()
  }

  return options?.replace ? router.replace(to) : router.push(to)
}

/** This will abort navigation within a Nuxt route middleware handler. */
export const abortNavigation = (err?: string | Partial<NuxtError>) => {
  if (process.dev && !isProcessingMiddleware()) {
    throw new Error('abortNavigation() is only usable inside a route middleware handler.')
  }
  if (err) {
    throw createError(err)
  }
  return false
}

export const setPageLayout = (layout: string) => {
  if (process.server) {
    useState('_layout').value = layout
  }
  const nuxtApp = useNuxtApp()
  const inMiddleware = isProcessingMiddleware()
  if (inMiddleware || process.server || nuxtApp.isHydrating) {
    const unsubscribe = useRouter().beforeResolve((to) => {
      to.meta.layout = layout
      unsubscribe()
    })
  }
  if (!inMiddleware) {
    useRoute().meta.layout = layout
  }
}
