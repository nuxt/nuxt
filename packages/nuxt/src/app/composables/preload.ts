import type { Component } from 'vue'
import type { RouteLocationRaw, RouteRecordNormalized, Router } from 'vue-router'
import type { NuxtAppLiterals } from '../types'
import { tryUseNuxtApp, useNuxtApp } from '../nuxt'
import { prefetchGroup } from '../internal/prefetch-util'
import { toArray } from '../utils'
import { useRouter } from './router'

/**
 * Preload a component or components that have been globally registered.
 * @param components Pascal-cased name or names of components to prefetch
 * @since 3.0.0
 */
export const preloadComponents = async (components: NuxtAppLiterals['componentName'] | Array<NuxtAppLiterals['componentName']>): Promise<void> => {
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
export const prefetchComponents = (components: NuxtAppLiterals['componentName'] | Array<NuxtAppLiterals['componentName']>): Promise<void> | undefined => {
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

function loadRouteComponents (matched: RouteRecordNormalized[]): Promise<unknown> {
  return Promise.all(matched.map((route) => {
    const component = route.components?.default
    return typeof component === 'function' ? Promise.resolve((component as () => unknown)()).catch(() => {}) : undefined
  }))
}

/** @since 3.0.0 */
export async function preloadRouteComponents (to: RouteLocationRaw, router: Router = useRouter()): Promise<void> {
  if (import.meta.server) { return }

  const { matched } = router.resolve(to)

  if (matched.length) {
    await loadRouteComponents(matched)
  }
}

/**
 * Queued form of `preloadRouteComponents`, throttled and promoted with the destination's other work.
 * @internal
 */
export function prefetchRouteComponents (to: RouteLocationRaw, router: Router): void {
  const { path, matched } = router.resolve(to)

  if (!matched.length) { return }

  const scheduler = tryUseNuxtApp()?._prefetch
  if (!scheduler) {
    void loadRouteComponents(matched)
    return
  }

  scheduler.schedule({
    key: `route:${path}`,
    priority: 'route',
    scope: 'navigation',
    group: prefetchGroup(path),
    // a duplicate or dequeued task does not load again; the first one owns the work
    run: signal => signal.aborted ? undefined : loadRouteComponents(matched),
  })
}
