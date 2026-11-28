import { useNuxtApp } from '../nuxt'
import { toArray } from '../utils'

/**
 * Record extra paths to prerender.
 *
 * Nuxt stores them on the request context. The server builder copies them onto the response,
 * and the prerenderer queues them. In the browser, and when the app is not prerendering, the
 * call does nothing.
 *
 * @since 3.8.0
 */
export function prerenderRoutes (path: string | string[]): void {
  if (!import.meta.server || !import.meta.prerender) { return }

  const context = useNuxtApp().ssrContext?.event?.context
  if (!context) { return }

  const nuxt = context.nuxt ||= {}
  nuxt.prerenderRoutes ||= []
  nuxt.prerenderRoutes.push(...toArray(path))
}
