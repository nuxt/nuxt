import { definePlugin } from 'nitro'
import type { H3Event } from 'nitro/h3'

import { legacyCacheControl } from './cache.ts'

/** The `cache-control` h3 writes for every response a cache route rule serves. */
const RULE_CACHE_CONTROL_RE = /^public, max-age=(\d+), s-maxage=\1$/

/** A request the cache route rule passes straight to the handler. */
function bypassesCache (request: Request): boolean {
  return (request.method !== 'GET' && request.method !== 'HEAD') || request.headers.has('range')
}

/**
 * Send the `cache-control` of Nitro v2 with the responses of a cache route rule, unless the
 * rule sets `sendCacheControl` or a `cache-control` header itself. A rule whose options set
 * none sends `public`.
 */
export default definePlugin((nitroApp) => {
  nitroApp.hooks?.hook('response', (response, event) => {
    const rules = (event as H3Event).context?.routeRules
    const cache = rules?.cache
    if (!cache || cache.sendCacheControl !== undefined || response.status === 304 || bypassesCache((event as H3Event).req) || Object.keys(rules.headers || {}).some(name => name.toLowerCase() === 'cache-control')) {
      return
    }
    if (!RULE_CACHE_CONTROL_RE.test(response.headers.get('cache-control') || '')) {
      return
    }
    response.headers.set('cache-control', legacyCacheControl(cache) ?? 'public')
  })
})
