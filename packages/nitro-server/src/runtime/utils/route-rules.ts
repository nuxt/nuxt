import { getRouteRules as getNitroRouteRules } from 'nitro/app'
import type { AppRouteRules, RequestEvent } from 'nuxt/schema'
import { withBaseURL } from './base.ts'

const ENCODED_SLASH_RE = /%2f/gi
const REPEATED_SLASH_RE = /\/{2,}/g

/**
 * The route rules nitro matched for the request. Nitro resolves them per method and
 * pathname, and registers them under the app base URL, which `createEvent` has removed.
 * A request nitro has already routed carries them on `event.context.routeRules`.
 */
export function getRouteRules (event: RequestEvent): AppRouteRules {
  const rules = (event.context.routeRules || getNitroRouteRules(event.req.method, withBaseURL(event.url.pathname)).routeRules || {}) as AppRouteRules
  return withSeparatedSlashes(rules, event.url.pathname, event.req.method)
}

export function matchRouteRules (path: string, method = 'GET'): AppRouteRules {
  const rules = (getNitroRouteRules(method, withBaseURL(path)).routeRules || {}) as AppRouteRules
  return withSeparatedSlashes(rules, path, method)
}

/**
 * `ssr` is off for a path when it is off for the path read with `%2F` as `/` and each run of
 * slashes collapsed to one, since a page route param spanning several segments decodes to the
 * same value either way. h3 does not apply a `false` rule matched through that reading.
 */
function withSeparatedSlashes (rules: AppRouteRules, path: string, method: string): AppRouteRules {
  if (!rules.ssr) { return rules }
  const separated = path.replace(ENCODED_SLASH_RE, '/').replace(REPEATED_SLASH_RE, '/')
  if (separated === path || getNitroRouteRules(method, withBaseURL(separated)).routeRules?.ssr) { return rules }
  return { ...rules, ssr: false }
}
