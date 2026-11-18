/**
 * The Nitro v2 cached handler helpers, implemented on `nitro/cache`.
 */
import { defineCachedHandler } from 'nitro/cache'
import { handleCacheHeaders, toResponse } from 'nitro/h3'
import type { H3Event } from 'nitro/h3'
import type { CachedHandlerOptions } from 'nitro/types'
import { legacyResponseHeaders } from '#nuxt-compat/flags'

import { fromLegacyBody } from './event.ts'

interface LegacyCacheOptions {
  swr?: boolean
  maxAge?: number
  staleMaxAge?: number
}

/** The `cache-control` Nitro v2 sent with a cached response, if any. */
export function legacyCacheControl (options: LegacyCacheOptions): string | undefined {
  const directives: string[] = []
  if (options.swr) {
    if (options.maxAge) {
      directives.push(`s-maxage=${options.maxAge}`)
    }
    directives.push(options.staleMaxAge ? `stale-while-revalidate=${options.staleMaxAge}` : 'stale-while-revalidate')
  } else if (options.maxAge) {
    directives.push(`max-age=${options.maxAge}`)
  }
  return directives.length > 0 ? directives.join(', ') : undefined
}

const UNCACHEABLE_RE = /(?:^|[\s,])(?:private|no-store|no-cache)(?:$|[\s,=])/i

/**
 * Send the `cache-control` of Nitro v2 in place of the one h3 writes for every cached
 * response. A handler's own value is kept only where it forbids shared caching. Options
 * Nitro v2 did not have (`headersOnly`, `stream`) keep the header of Nitro v3.
 */
function withLegacyCacheControl (options: CachedHandlerOptions | undefined): CachedHandlerOptions | undefined {
  if (options?.sendCacheControl !== undefined || options?.headersOnly || options?.stream) {
    return options
  }
  // a handler defined without options was cached with `swr` for a second in Nitro v2
  const cacheControl = legacyCacheControl(options ?? { swr: true, maxAge: 1 })
  const own = new WeakMap<H3Event, string>()
  return {
    ...options,
    sendCacheControl: false,
    toResponse: async (result: unknown, event: H3Event) => {
      const response = await toResponse(result, event)
      const value = response.headers.get('cache-control')
      if (value && UNCACHEABLE_RE.test(value)) {
        own.set(event, value)
      }
      return response
    },
    handleCacheHeaders: (event: H3Event, conditions: Parameters<typeof handleCacheHeaders>[1]) => {
      const matched = handleCacheHeaders(event, conditions)
      const value = own.get(event) ?? cacheControl
      if (value) {
        event.res.headers.set('cache-control', value)
      } else {
        event.res.headers.delete('cache-control')
      }
      return matched
    },
  } as CachedHandlerOptions
}

/** v2 `defineCachedEventHandler`, which sends what the handler returns as h3 v1 did. */
export const defineCachedEventHandler: typeof defineCachedHandler = (handler, options) =>
  defineCachedHandler(async event => fromLegacyBody(event as H3Event, await handler(event)), legacyResponseHeaders ? withLegacyCacheControl(options) : options)

export { defineCachedEventHandler as cachedEventHandler }
