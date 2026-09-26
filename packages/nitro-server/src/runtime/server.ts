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

import {
  clearSession as clearNuxtSession,
  createError,
  getSession as getNuxtSession,
  updateSession as updateNuxtSession,
  useSession as useNuxtSession,
} from 'nuxt/internal/server-default'

import { bufferRequestBody } from './utils/body'
import { serverDiagnostics } from './diagnostics'

export {
  deleteCookie,
  getCookie,
  getQuery,
  getRequestIP,
  getRequestURL,
  getRouterParam,
  getRouterParams,
  getValidatedQuery,
  handleCors,
  readBody,
  readValidatedBody,
  setCookie,
} from 'nitro/h3'

export { getRouteRules } from './utils/route-rules'
export { useRuntimeConfig } from 'nitro/runtime-config'

export {
  createError,
  deriveSecret,
  getRequestHeader,
  getRequestHeaders,
  isNuxtError,
  NuxtError,
  sendRedirect,
  setResponseStatus,
  toNuxtRequestEvent,
  useAppConfig,
} from 'nuxt/internal/server-default'

export const clearSession = /* #__PURE__ */ requireRequestEvent('clearSession', clearNuxtSession)
export const getSession = /* #__PURE__ */ requireRequestEvent('getSession', getNuxtSession)
export const updateSession = /* #__PURE__ */ requireRequestEvent('updateSession', updateNuxtSession)
export const useSession = /* #__PURE__ */ requireRequestEvent('useSession', useNuxtSession)

function requireRequestEvent<F extends (event: any, ...args: any[]) => any> (helper: string, fn: F): F {
  return function (this: unknown, event: Record<string, unknown>, ...args: unknown[]) {
    if (event && !event.req && 'node' in event) {
      const diagnostic = serverDiagnostics.NUXT_E8012({ helper })
      throw createError({ status: 500, statusText: 'Server Error', message: `[${diagnostic.code}] ${diagnostic.message} ${diagnostic.fix}` })
    }
    return fn.call(this, event, ...args)
  } as F
}

/** A handler h3's router can serve directly, whose body can be read more than once. */
export function defineEventHandler<Result> (handler: EventHandler<Result>): EventHandler<Result> {
  return defineH3EventHandler((event) => {
    bufferRequestBody(event)
    return handler(event as RequestEvent) as Result
  }) as unknown as EventHandler<Result>
}
