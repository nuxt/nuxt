import type { Nitro } from 'nitro/types'
import { buildDiagnostics } from '@nuxt/kit/internal'

/**
 * Fail the build with a diagnostic naming the routes that failed to prerender. The check is
 * registered once prerendering starts, so it runs after every other `prerender:done` listener.
 */
export function failOnPrerenderErrors (nitro: Nitro): void {
  nitro.hooks.hook('prerender:init', () => {
    nitro.hooks.hookOnce('prerender:done', ({ failedRoutes }) => {
      if (!nitro.options.prerender.failOnError) {
        return
      }
      const ignoreStatusCodes = nitro.options.prerender.ignoreStatusCodes || []
      const fatalRoutes = failedRoutes.filter(route => !ignoreStatusCodes.includes(route.error?.status as number))
      if (fatalRoutes.length) {
        throw buildDiagnostics.NUXT_B1024({ routes: fatalRoutes.map(route => ({ route: route.route, status: route.error?.status })) })
      }
    })
  })
}
