import { getRouteRules as getNitroRouteRules } from 'nitro/app'
import type { AppRouteRules, RequestEvent } from 'nuxt/schema'
import { withBaseURL } from './base.ts'

/**
 * The route rules nitro matched for the request. Nitro resolves them per method and
 * pathname, and registers them under the app base URL, which `createEvent` has removed.
 * A request nitro has already routed carries them on `event.context.routeRules`.
 */
export function getRouteRules (event: RequestEvent): AppRouteRules {
  return (event.context.routeRules || getNitroRouteRules(event.req.method, withBaseURL(event.url.pathname)).routeRules || {}) as AppRouteRules
}
