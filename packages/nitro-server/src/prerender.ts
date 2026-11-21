import type { Nitro } from 'nitropack/types'
import { buildDiagnostics } from '@nuxt/kit/internal'

/**
 * Fail the build with a diagnostic naming the routes that failed to prerender. The check is
 * registered once prerendering starts, so it runs after every other `prerender:done` listener.
 */
export function failOnPrerenderErrors (nitro: Nitro): void {
  nitro.hooks.hook('prerender:init', () => {
    nitro.hooks.hookOnce('prerender:done', ({ failedRoutes }) => {
      if (!nitro.options.prerender.failOnError || !failedRoutes.length) {
        return
      }
      throw buildDiagnostics.NUXT_B1024({ routes: failedRoutes.map(route => ({ route: route.route, status: route.error?.statusCode })) }, { method: 'error' })
    })
  })
}
