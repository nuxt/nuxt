import type { Component } from 'vue'
import type { RouteLocationRaw, Router } from 'vue-router'
import { useNuxtApp } from '../nuxt'
import { useRouter } from './router'

/**
 * Preload a component or components that have been globally registered.
 *
 * @param components Pascal-cased name or names of components to prefetch
 */
export const preloadComponents = async (components: string | string[]) => {
  if (process.server) { return }
  const nuxtApp = useNuxtApp()

  components = Array.isArray(components) ? components : [components]
  await Promise.all(components.map(name => _loadAsyncComponent(nuxtApp.vueApp._context.components[name])))
}

/**
 * Prefetch a component or components that have been globally registered.
 *
 * @param components Pascal-cased name or names of components to prefetch
 */
export const prefetchComponents = (components: string | string[]) => {
  // TODO
  return preloadComponents(components)
}

// --- Internal ---

function _loadAsyncComponent (component: Component) {
  if ((component as any)?.__asyncLoader && !(component as any).__asyncResolved) {
    return (component as any).__asyncLoader()
  }
}

export async function preloadRouteComponents (to: RouteLocationRaw, router: Router & { _routePreloaded?: Set<string>; _preloadPromises?: Array<Promise<any>> } = useRouter()): Promise<void> {
  if (process.server) { return }

  const { path, matched } = router.resolve(to)

  if (!matched.length) { return }
  if (!router._routePreloaded) { router._routePreloaded = new Set() }
  if (router._routePreloaded.has(path)) { return }

  const promises = router._preloadPromises = router._preloadPromises || []

  if (promises.length > 4) {
    // Defer adding new preload requests until the existing ones have resolved
    return Promise.all(promises).then(() => preloadRouteComponents(to, router))
  }

  router._routePreloaded.add(path)

  const components = matched
    .map(component => component.components?.default)
    .filter(component => typeof component === 'function')

  for (const component of components) {
    const promise = Promise.resolve((component as Function)())
      .catch(() => {})
      .finally(() => promises.splice(promises.indexOf(promise)))
    promises.push(promise)
  }

  await Promise.all(promises)
}
