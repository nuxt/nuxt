/**
 * The `nuxt/server` implementations for a Nitro-backed build, registered as
 * `serverBuild.runtime.server`.
 *
 * Only the helpers h3 does more with than the platform alone can are taken from it:
 * resolving the request URL through forwarded headers, merging `Set-Cookie` against the
 * headers already queued for the response, negotiating the body against the request the
 * router matched, and marking a handler so the router can serve it directly. The rest come
 * from the shipped implementations, which is also what h3 v2's own deprecations point at.
 *
 * The types come from `nuxt/server` whichever module backs it, so every name it exports
 * must be exported here too.
 */
import { defineEventHandler as defineH3EventHandler } from 'nitro/h3'
import type { EventHandler, RequestEvent } from 'nuxt/server'

import { bufferRequestBody } from './utils/body'

export {
  deleteCookie,
  getCookie,
  getQuery,
  getRequestURL,
  readBody,
  setCookie,
} from 'nitro/h3'

export { getRouteRules } from './utils/route-rules'
export { useRuntimeConfig } from 'nitro/runtime-config'

export {
  createError,
  getRequestHeader,
  getRequestHeaders,
  isNuxtError,
  NuxtError,
  sendRedirect,
  setResponseHeader,
  setResponseHeaders,
  setResponseStatus,
  toNuxtRequestEvent,
} from 'nuxt/internal/server-default'

/** A handler h3's router can serve directly, whose body can be read more than once. */
export function defineEventHandler<Result> (handler: EventHandler<Result>): EventHandler<Result> {
  return defineH3EventHandler((event) => {
    bufferRequestBody(event)
    return handler(event as RequestEvent) as Result
  }) as unknown as EventHandler<Result>
}
