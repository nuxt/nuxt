/**
 * The Nitro v2 cached handler and function helpers, implemented on `nitro/cache`.
 */
import { defineCachedHandler, defineCachedFunction as nitroDefineCachedFunction } from 'nitro/cache'
import { handleCacheHeaders, toResponse } from 'nitro/h3'
import type { EventHandler, EventHandlerRequest, EventHandlerResponse, EventHandlerWithFetch, H3Event } from 'nitro/h3'
import { FastResponse } from 'srvx'
import type { CachedFunction, CachedFunctionOptions, CachedHandlerOptions } from 'nitro/types'
import { legacyResponseHeaders } from '#nuxt-compat/flags'

import { fromLegacyBody } from './event.ts'

interface LegacyCacheOptions {
  swr?: boolean
  maxAge?: number
  staleMaxAge?: number
}

/** The `cache-control` Nitro v2 wrote from the options of a cached response, if any. */
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

/** The statuses `nitro/cache` serves from an entry, and the `304` it revalidates them with. */
const CACHED_STATUSES = new Set([200, 203, 301, 304, 308])

/**
 * Send the `cache-control` of Nitro v2 in place of the one h3 writes for every cached
 * response. A handler's own value is kept where it forbids shared caching, or where the
 * options set none; with neither, the response is sent with `public`. The value is read from
 * the cached response so that every request served from it gets the same header. A response
 * with any other status keeps its own headers. Options Nitro v2 did not have (`headersOnly`,
 * `stream`) keep the header of Nitro v3.
 */
function withLegacyCacheControl (options: CachedHandlerOptions | undefined): CachedHandlerOptions | undefined {
  if (options?.sendCacheControl !== undefined || options?.headersOnly || options?.stream) {
    return options
  }
  // a handler defined without options was cached with `swr` for a second in Nitro v2
  const cacheControl = legacyCacheControl(options ?? { swr: true, maxAge: 1 })
  return {
    ...options,
    sendCacheControl: false,
    handleCacheHeaders: (event: H3Event, conditions: Parameters<typeof handleCacheHeaders>[1]) => {
      const matched = handleCacheHeaders(event, conditions)
      event.res.headers.delete('cache-control')
      return matched
    },
    createResponse: (body: BodyInit | null, init?: ResponseInit) => {
      if (!CACHED_STATUSES.has(init?.status ?? 200)) {
        return new FastResponse(body, init)
      }
      const headers = new Headers(init?.headers)
      const value = headers.get('cache-control')
      if (cacheControl && !(value && UNCACHEABLE_RE.test(value))) {
        headers.set('cache-control', cacheControl)
      } else if (!value) {
        headers.set('cache-control', 'public')
      }
      return new FastResponse(body, { ...init, headers })
    },
  } as CachedHandlerOptions
}

/**
 * A cached handler. Called directly, it resolves to the `Response` it serves; `fetch` types the
 * body of that response as what the handler it caches returns.
 */
export type CachedEventHandler<RequestT extends EventHandlerRequest = EventHandlerRequest, ResponseT = EventHandlerResponse> =
  EventHandler<RequestT, Promise<Response>> & Pick<EventHandlerWithFetch<RequestT, Awaited<ResponseT>>, 'fetch'>

/**
 * v2 `defineCachedEventHandler`, which sends what the handler returns as h3 v1 did, and serves
 * an expired entry while it revalidates unless `swr` is `false`.
 */
export function defineCachedEventHandler<RequestT extends EventHandlerRequest = EventHandlerRequest, ResponseT = EventHandlerResponse> (handler: EventHandler<RequestT, ResponseT>, options?: CachedHandlerOptions): CachedEventHandler<RequestT, ResponseT> {
  return defineCachedHandler(handler as EventHandler, {
    ...legacyResponseHeaders ? withLegacyCacheControl(options) : options,
    swr: options?.swr ?? true,
    toResponse: (value: unknown, event: H3Event) => toResponse(fromLegacyBody(event, value), event),
  } as CachedHandlerOptions) as unknown as CachedEventHandler<RequestT, ResponseT>
}

/** v2 `defineCachedFunction`, which serves an expired entry while it revalidates unless `swr` is `false`. */
export function defineCachedFunction<T, ArgsT extends unknown[] = any[]> (fn: (...args: ArgsT) => T | Promise<T>, options?: CachedFunctionOptions<T, ArgsT>): CachedFunction<T, ArgsT> {
  return nitroDefineCachedFunction(fn, { ...options, swr: options?.swr ?? true })
}

export { defineCachedEventHandler as cachedEventHandler, defineCachedFunction as cachedFunction }
