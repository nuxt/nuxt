import { bundlerDiagnostics } from '@nuxt/kit/internal'
import type { NitroConfig } from 'nitro/types'

/**
 * Rewrites `redirect.statusCode` to `redirect.status`, warning once per route.
 *
 * The nitro v2 spelling is silently ignored by the version Nuxt now builds on, which would turn
 * a configured redirect status into a default without any indication.
 */
export function normalizeLegacyRouteRules (routeRules: NitroConfig['routeRules']): void {
  for (const route in routeRules) {
    const redirect = routeRules[route]?.redirect
    if (!redirect || typeof redirect !== 'object' || !('statusCode' in redirect)) { continue }

    const { statusCode, ...rest } = redirect as { statusCode?: number, status?: number, to: string }
    routeRules[route]!.redirect = { ...rest, status: rest.status ?? statusCode }
    bundlerDiagnostics.NUXT_B7026({ route })
  }
}
