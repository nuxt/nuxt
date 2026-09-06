/**
 * The `nuxt/server` implementations for a nitropack v2 build, registered as
 * `serverBuild.runtime.server`.
 *
 * Every name `nuxt/server` exports is exported here, because none of the shipped
 * implementations can be reused: they read the request and response in the web-standard
 * shape, and an h3 v1 event has neither. h3 v1's own helpers take the event instead, so
 * this is a rename of them plus the few Nuxt adds.
 *
 * The types come from `nuxt/server` whichever module backs it, so a name missing here is
 * a runtime error rather than a type error; `test/server.test.ts` guards that.
 */
import {
  createError as createH3Error,
  deleteCookie,
  getCookie,
  getQuery as getH3Query,
  getRequestHeader as getH3RequestHeader,
  getRequestHeaders as getH3RequestHeaders,
  getRequestURL,
  readBody,
  setCookie,
  setResponseHeader,
  setResponseHeaders,
  setResponseStatus,
} from 'h3'
import type { H3Event } from 'h3'
import { getRouteRules as getNitroRouteRules, useRuntimeConfig as useNitroRuntimeConfig } from 'nitropack/runtime'
import type { AppRouteRules, RuntimeConfig } from 'nuxt/schema'
import type { EventHandler, NuxtErrorLike } from 'nuxt/server'

import { NUXT_ERROR_SIGNATURE } from '#app/error'

export {
  deleteCookie,
  getCookie,
  getRequestURL,
  readBody,
  setCookie,
  setResponseHeader,
  setResponseHeaders,
  setResponseStatus,
}

export type { AppRouteRules, RequestEventFallback, ServerRoutes } from 'nuxt/schema'
export type { EventHandler, NuxtError, NuxtErrorJSON, NuxtErrorLike, RequestEvent, RuntimeRequestEvent } from 'nuxt/server'

/** @see {@link import('nuxt/server').defineEventHandler} */
export function defineEventHandler<Result> (handler: EventHandler<Result>): EventHandler<Result> {
  return handler
}

/**
 * @see {@link import('nuxt/server').createError}
 *
 * h3 v1 recognises an error of its own by the marker its constructor carries, so the error
 * has to be one it made; `status`/`statusText` are the names it knows as
 * `statusCode`/`statusMessage`.
 */
export function createError (input: string | (Error & { status?: number, statusText?: string, data?: unknown }) | { status?: number, statusText?: string, message?: string, data?: unknown, fatal?: boolean, unhandled?: boolean }): NuxtErrorLike {
  if (typeof input === 'string') {
    return withSignature(createH3Error(input))
  }
  const { status, statusText, ...rest } = input as { status?: number, statusText?: string }
  return withSignature(createH3Error({
    ...rest,
    ...status === undefined ? {} : { statusCode: status },
    ...statusText === undefined ? {} : { statusMessage: statusText, message: (input as { message?: string }).message ?? statusText },
  }))
}

/** Mark an h3 error as Nuxt's, so `isNuxtError()` recognises it either side of the wire. */
function withSignature (error: Error): NuxtErrorLike {
  if (!(NUXT_ERROR_SIGNATURE in error)) {
    Object.defineProperty(error, NUXT_ERROR_SIGNATURE, { value: true, configurable: false, writable: false })
  }
  return withPortableStatus(error)
}

/**
 * Read the status of an h3 v1 error under the names the portable surface promises.
 *
 * h3 v1 carries it as `statusCode`/`statusMessage`, and `NuxtErrorLike` declares
 * `status`/`statusText`, so without this a handler that branches on `error.status` reads
 * `undefined` here and a number on a server runtime built against h3 v2.
 */
function withPortableStatus (error: Error): NuxtErrorLike {
  const target = error as Error & { status?: number, statusText?: string, statusCode?: number, statusMessage?: string }
  if (target.status === undefined && target.statusCode !== undefined) {
    Object.defineProperty(target, 'status', { get: () => target.statusCode, configurable: true })
  }
  if (target.statusText === undefined && target.statusMessage !== undefined) {
    Object.defineProperty(target, 'statusText', { get: () => target.statusMessage, configurable: true })
  }
  return target as NuxtErrorLike
}

/**
 * @see {@link import('nuxt/server').isNuxtError}
 *
 * h3 v1 carries the status as `statusCode`, and identifies its own errors by a marker on
 * the constructor rather than by name.
 */
export function isNuxtError<DataT = unknown> (error: unknown): error is NuxtErrorLike<DataT> {
  if (!(error instanceof Error)) {
    return false
  }
  const candidate = error as { status?: unknown, statusCode?: unknown, constructor?: { __h3_error__?: unknown } }
  if (typeof candidate.status !== 'number' && typeof candidate.statusCode !== 'number') {
    return false
  }
  if (!(NUXT_ERROR_SIGNATURE in error) && candidate.constructor?.__h3_error__ !== true) {
    return false
  }
  // an error nitro threw for itself carries the h3 v1 names only
  withPortableStatus(error)
  return true
}

/** @see {@link import('nuxt/server').getRequestHeader} */
export function getRequestHeader (event: H3Event, name: string): string | undefined {
  return getH3RequestHeader(event, name) || undefined
}

/** @see {@link import('nuxt/server').getRequestHeaders} */
export function getRequestHeaders (event: H3Event): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(getH3RequestHeaders(event))) {
    if (value !== undefined) {
      headers[name] = value
    }
  }
  return headers
}

/** @see {@link import('nuxt/server').getQuery} */
export function getQuery<T extends Record<string, unknown> = Record<string, string | string[]>> (event: H3Event): T {
  return getH3Query(event) as T
}

/**
 * @see {@link import('nuxt/server').sendRedirect}
 *
 * h3 v1's own `sendRedirect` writes the response and resolves to nothing, where the
 * portable surface sets the response and returns the body to respond with. The body is
 * built here rather than taken from h3, so a handler that returns it behaves the same on
 * every server runtime.
 */
export function sendRedirect (event: H3Event, location: string, status = 302): string {
  setResponseStatus(event, status)
  setResponseHeader(event, 'location', location)
  setResponseHeader(event, 'content-type', 'text/html')
  const encoded = location.replace(REDIRECT_UNSAFE_RE, char => REDIRECT_ESCAPES[char]!)
  return `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${encoded}"></head></html>`
}

const REDIRECT_ESCAPES: Record<string, string> = { '"': '%22', '\'': '%27', '<': '%3C', '>': '%3E', '&': '%26' }
const REDIRECT_UNSAFE_RE = /["'<>&]/g

/** @see {@link import('nuxt/server').getRouteRules} */
export function getRouteRules (event: H3Event): AppRouteRules {
  return getNitroRouteRules(event) as AppRouteRules
}

/** @see {@link import('nuxt/server').useRuntimeConfig} */
export function useRuntimeConfig (event?: H3Event): RuntimeConfig {
  return useNitroRuntimeConfig(event) as RuntimeConfig
}
