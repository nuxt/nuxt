import type { RouteMeta } from 'vue-router'
import { abortNavigation } from '#app/composables/router'
import { navigationDiagnostics } from '../../app/diagnostics/navigation'

/**
 * Page metadata for a page whose `definePageMeta()` call threw while being evaluated.
 * Navigating to the page fails with a fatal 500 error.
 * @internal
 */
export function createPageMetaError (cause: unknown, file?: string): RouteMeta {
  const error = navigationDiagnostics.NUXT_E2013({ cause, sources: file ? [file] : undefined })
  return {
    middleware: () => abortNavigation({ status: 500, statusText: error.name, fatal: true, cause: error }),
  }
}
