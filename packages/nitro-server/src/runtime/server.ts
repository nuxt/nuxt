/**
 * The `nuxt/server` implementations for a Nitro-backed build, registered as
 * `serverBuild.runtime.server`. Request helpers come from h3; route rules, runtime config,
 * hooks and `serverFetch` from Nitro; the rest from `nuxt/internal/server-default`.
 *
 * The types come from `nuxt/server`, so every name it exports must be exported here too.
 */
import { defineEventHandler as defineH3EventHandler, defineValidatedHandler as defineH3ValidatedHandler } from 'nitro/h3'
import { serverFetch as nitroServerFetch } from 'nitro'
import type { defineValidatedHandler as DefineValidatedHandler, EventHandler, RequestEvent, ServerFetchInit } from 'nuxt/server'

import {
  clearSession as clearNuxtSession,
  createError,
  getSession as getNuxtSession,
  resolveServerFetchInit,
  updateSession as updateNuxtSession,
  useSession as useNuxtSession,
} from 'nuxt/internal/server-default'

import { withBaseURL } from './utils/base'
import { bufferRequestBody } from './utils/body'
import { serverDiagnostics } from './diagnostics'

export {
  deleteCookie,
  getCookie,
  getQuery,
  getRequestHost,
  getRequestIP,
  getRequestProtocol,
  getRequestURL,
  getRouterParam,
  getRouterParams,
  getValidatedQuery,
  handleCors,
  readBody,
  readValidatedBody,
  setCookie,
} from 'nitro/h3'

export { getRouteRules, matchRouteRules } from './utils/route-rules'
export { useRuntimeConfig } from 'nitro/runtime-config'
export { useNitroHooks as useServerHooks } from 'nitro/app'

export {
  createError,
  deriveSecret,
  getRequestHeader,
  getRequestHeaders,
  isNuxtError,
  NuxtError,
  parseCookies,
  sendRedirect,
  setResponseStatus,
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

/** h3's own, with the body buffered as for {@link defineEventHandler}. */
export const defineValidatedHandler = (definition => defineEventHandler(defineH3ValidatedHandler(definition as never) as never)) as typeof DefineValidatedHandler

export function serverFetch (event: Pick<RequestEvent, 'req' | 'context'>, path: string, init?: ServerFetchInit): Promise<Response> {
  return nitroServerFetch(withBaseURL(path), resolveServerFetchInit(event, init), { nuxt: { '~internal': true } })
}
