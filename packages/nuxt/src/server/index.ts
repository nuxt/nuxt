/**
 * The portable server surface, typed against {@link RequestEvent}: the event
 * type the configured `server.builder` contributes. Code written against it
 * runs unchanged on any Nuxt server builder, and across an h3 or Nitro major.
 *
 * The implementations here are web-standard, over the
 * {@link RequestEventFallback} shape. A server builder whose runtime can do
 * better replaces this module in its own bundle.
 *
 * For anything not exported here, import from the server runtime itself
 * (`nitro`, `nitro/h3`), and accept that the code is pinned to it.
 *
 * @module nuxt/server
 */
import { parse, serialize } from 'cookie-es'
import type { CookieSerializeOptions } from 'cookie-es'
import { parseQuery } from 'ufo'
import type { AppRouteRules, RequestEvent, RequestEventFallback, RuntimeConfig } from 'nuxt/schema'
import { useRuntimeConfig as _useRuntimeConfig } from 'nuxt/internal/server-runtime-config'

import { NUXT_ERROR_SIGNATURE, NuxtError, createError } from '../app/error'
import type { NuxtError as NuxtErrorContract } from '../app/types'

export type { AppRouteRules, RequestEvent, RequestEventFallback, ServerRoutes } from 'nuxt/schema'
export type { NuxtErrorDetails } from '../app/error'
export type { NuxtErrorJSON } from '../app/types'

/**
 * A request handler, as {@link defineEventHandler} returns it.
 *
 * @since 5.0.0
 */
export type EventHandler<Result = unknown> = (event: RequestEvent) => Result

/** The web-standard shape every server builder's event is a superset of. */
function web (event: RequestEvent): RequestEventFallback {
  return event as unknown as RequestEventFallback
}

/**
 * Define a request handler.
 *
 * The return type is preserved exactly, and is what types `$fetch` and
 * `useFetch` calls to the route, so annotate the returned value rather than
 * the handler.
 *
 * @example
 * ```ts
 * // server/api/hello.ts
 * import { defineEventHandler, getQuery } from 'nuxt/server'
 *
 * export default defineEventHandler((event) => {
 *   const { name } = getQuery<{ name?: string }>(event)
 *   return { message: `Hello, ${name ?? 'world'}!` }
 * })
 * ```
 *
 * @since 5.0.0
 */
export function defineEventHandler<Result> (handler: EventHandler<Result>): EventHandler<Result> {
  return handler
}

export { createError, NuxtError }

/**
 * The shape shared by every HTTP error reachable in server code: the ones
 * {@link createError} constructs, and the ones the server runtime throws for
 * itself, which are not `NuxtError`s.
 *
 * @since 5.0.0
 */
export type NuxtErrorLike<DataT = unknown> = Error
  & Pick<NuxtErrorContract<DataT>, 'status'>
  & Partial<Pick<NuxtErrorContract<DataT>, 'statusText' | 'headers' | 'data' | 'unhandled'>>

/**
 * Whether a caught value is an HTTP error carrying a status.
 *
 * The check is structural, because the error may have been constructed by the
 * server runtime rather than by {@link createError}. h3 identifies its own
 * errors by `name`, which is why Nuxt's errors report `HTTPError` as theirs.
 *
 * @example
 * ```ts
 * try {
 *   await load()
 * } catch (error) {
 *   if (isNuxtError(error) && error.status === 404) {
 *     return null
 *   }
 *   throw error
 * }
 * ```
 *
 * @since 5.0.0
 */
export function isNuxtError<DataT = unknown> (error: unknown): error is NuxtErrorLike<DataT> {
  const candidate = error as { status?: unknown, [NUXT_ERROR_SIGNATURE]?: unknown } | null | undefined
  if (!(error instanceof Error) || typeof candidate?.status !== 'number') {
    return false
  }
  return candidate[NUXT_ERROR_SIGNATURE] === true || error.name === 'HTTPError'
}

/**
 * The URL of the incoming request.
 *
 * @since 5.0.0
 */
export function getRequestURL (event: RequestEvent): URL {
  return web(event).url
}

/**
 * Read one request header, or `undefined` when it was not sent.
 *
 * Header names are case-insensitive.
 *
 * @since 5.0.0
 */
export function getRequestHeader (event: RequestEvent, name: string): string | undefined {
  return web(event).req.headers.get(name) ?? undefined
}

/**
 * Read every request header, keyed by lowercased name.
 *
 * @since 5.0.0
 */
export function getRequestHeaders (event: RequestEvent): Record<string, string> {
  return Object.fromEntries(web(event).req.headers)
}

/**
 * Set the status, and optionally the reason phrase, of the response.
 *
 * @since 5.0.0
 */
export function setResponseStatus (event: RequestEvent, status: number, statusText?: string): void {
  const res = web(event).res
  res.status = status
  if (statusText !== undefined) {
    res.statusText = statusText
  }
}

/**
 * Set one response header, replacing any value already set for it.
 *
 * @since 5.0.0
 */
export function setResponseHeader (event: RequestEvent, name: string, value: string): void {
  web(event).res.headers.set(name, value)
}

/**
 * Set several response headers, replacing any values already set for them.
 *
 * @since 5.0.0
 */
export function setResponseHeaders (event: RequestEvent, headers: Record<string, string>): void {
  const target = web(event).res.headers
  for (const name in headers) {
    target.set(name, headers[name]!)
  }
}

/**
 * Read the query string of the request. A repeated parameter resolves to an
 * array, so a type parameter should account for that.
 *
 * @since 5.0.0
 */
export function getQuery<T extends Record<string, unknown> = Record<string, string | string[]>> (event: RequestEvent): T {
  return parseQuery(web(event).url.search) as T
}

/**
 * Read and parse the request body, once per request.
 *
 * A URL-encoded body is parsed into an object of its fields, with a repeated
 * field collected into an array. Anything else is parsed as JSON, and a body
 * that is not valid JSON is a `400`. An empty body reads as `undefined`.
 *
 * The type parameter is an assertion: validate the result with a schema when
 * it comes from a client.
 *
 * @since 5.0.0
 */
export async function readBody<T = unknown> (event: RequestEvent): Promise<T> {
  const request = web(event).req
  const contentType = request.headers.get('content-type') || ''
  const text = await request.text()

  if (!text) {
    return undefined as T
  }

  if (contentType.startsWith('application/x-www-form-urlencoded')) {
    return collectEntries(new URLSearchParams(text).entries()) as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw createError({ status: 400, statusText: 'Bad Request', message: 'Invalid JSON body' })
  }
}

/** Collect repeated keys into an array, as a form body's fields are read. */
function collectEntries (entries: Iterable<[string, string]>): Record<string, string | string[]> {
  const parsed: Record<string, string | string[]> = Object.create(null)
  for (const [key, value] of entries) {
    const existing = parsed[key]
    if (existing === undefined) {
      parsed[key] = value
    } else if (Array.isArray(existing)) {
      existing.push(value)
    } else {
      parsed[key] = [existing, value]
    }
  }
  return parsed
}

/**
 * Read one cookie sent with the request, or `undefined` when it was not sent.
 *
 * @since 5.0.0
 */
export function getCookie (event: RequestEvent, name: string): string | undefined {
  const header = web(event).req.headers.get('cookie')
  return header ? parse(header)[name] : undefined
}

/**
 * Set a cookie on the response. Each call appends its own `Set-Cookie`
 * header, so several cookies may be set for one response.
 *
 * @since 5.0.0
 */
export function setCookie (event: RequestEvent, name: string, value: string, options?: CookieSerializeOptions): void {
  web(event).res.headers.append('set-cookie', serialize(name, value, { path: '/', ...options }))
}

/**
 * Expire a cookie on the response. The `path` and `domain` must match those
 * it was set with, or the original cookie survives alongside the expired one.
 *
 * @since 5.0.0
 */
export function deleteCookie (event: RequestEvent, name: string, options?: CookieSerializeOptions): void {
  setCookie(event, name, '', { ...options, maxAge: 0 })
}

/**
 * Redirect the request, returning the body to respond with: a
 * `<meta http-equiv="refresh">`, so a client that ignores the status still
 * follows the redirect.
 *
 * @example
 * ```ts
 * export default defineEventHandler(event => sendRedirect(event, '/login', 302))
 * ```
 *
 * @since 5.0.0
 */
export function sendRedirect (event: RequestEvent, location: string, status = 302): string {
  setResponseStatus(event, status)
  setResponseHeader(event, 'location', location)
  setResponseHeader(event, 'content-type', 'text/html')
  const encoded = location.replace(REDIRECT_UNSAFE_RE, char => REDIRECT_ESCAPES[char]!)
  return `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${encoded}"></head></html>`
}

const REDIRECT_ESCAPES: Record<string, string> = { '"': '%22', '\'': '%27', '<': '%3C', '>': '%3E', '&': '%26' }
const REDIRECT_UNSAFE_RE = /["'<>&]/g

/**
 * The route rules matched for the request. A server builder without a
 * route-rule matcher resolves none, so treat every rule as optional.
 *
 * @since 5.0.0
 */
export function getRouteRules (_event: RequestEvent): AppRouteRules {
  return {}
}

/**
 * The runtime configuration, including the keys only the server can read.
 *
 * @since 5.0.0
 */
export function useRuntimeConfig (): RuntimeConfig {
  return _useRuntimeConfig() as RuntimeConfig
}
