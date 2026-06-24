import type { Component } from 'vue'
import type { RouteLocationRaw, Router } from 'vue-router'
import { useNuxtApp } from '../nuxt'
import { toArray } from '../utils'
import { useRouter } from './router'

/**
 * Preload a component or components that have been globally registered.
 * @param components Pascal-cased name or names of components to prefetch
 * @since 3.0.0
 */
export const preloadComponents = async (components: string | string[]): Promise<void> => {
  if (import.meta.server) { return }
  const nuxtApp = useNuxtApp()

  components = toArray(components)
  await Promise.all(components.map((name) => {
    const component = nuxtApp.vueApp._context.components[name]
    if (component) {
      return _loadAsyncComponent(component)
    }
  }))
}

/**
 * Prefetch a component or components that have been globally registered.
 * @param components Pascal-cased name or names of components to prefetch
 * @since 3.0.0
 */
export const prefetchComponents = (components: string | string[]): Promise<void> | undefined => {
  if (import.meta.server) { return }

  // TODO
  return preloadComponents(components)
}

// --- Internal ---

export function _loadAsyncComponent (component: Component): unknown {
  if ((component as any)?.__asyncLoader && !(component as any).__asyncResolved) {
    return (component as any).__asyncLoader()
  }
}

/** @since 3.0.0 */
export async function preloadRouteComponents (to: RouteLocationRaw, router: Router & { _routePreloaded?: Set<string>, _preloadPromises?: Array<Promise<unknown>> } = useRouter()): Promise<void> {
  if (import.meta.server) { return }

  const { path, matched } = router.resolve(to)

  if (!matched.length) { return }
  router._routePreloaded ||= new Set()
  if (router._routePreloaded.has(path)) { return }

  const promises = router._preloadPromises ||= []

  if (promises.length > 4) {
    // Defer adding new preload requests until the existing ones have resolved
    return Promise.all(promises).then(() => preloadRouteComponents(to, router))
  }

  router._routePreloaded.add(path)

  for (const route of matched) {
    const component = route.components?.default
    if (typeof component !== 'function') {
      continue
    }
    // NB: deliberately swallowed — do NOT report a diagnostic here (the
    // reserved code NUXT_E2011 stays unused). Preloading is a best-effort
    // optimization; failures are routine (cancelled navigation, offline, a
    // lazy chunk that loads fine on actual navigation) and a warning would be
    // noisy and non-actionable.
    const promise = Promise.resolve((component as () => unknown)())
      .catch(() => {})
      .finally(() => promises.splice(promises.indexOf(promise), 1))
    promises.push(promise)
  }

  await Promise.all(promises)
}
