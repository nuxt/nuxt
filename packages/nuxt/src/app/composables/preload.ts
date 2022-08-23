import type { Component } from 'vue'
import { useNuxtApp } from '#app'

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
