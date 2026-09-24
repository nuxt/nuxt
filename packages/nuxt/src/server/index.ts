/**
 * The portable server surface: helpers typed against {@link RequestEvent}, the
 * web-standard part of the event every server runtime provides. Code written
 * against them runs on any Nuxt server builder.
 *
 * {@link toNuxtRequestEvent} returns the event in the shape the configured
 * `server.builder` provides. Anything not exported here comes from the server
 * runtime itself (`nitro`, `nitro/h3`), and pins the code to it.
 *
 * @module nuxt/server
 */
import { parse, serialize } from 'cookie-es'
import type { CookieSerializeOptions } from '../app/types/cookie'
import { parseQuery } from 'ufo'
import type { AppRouteRules, NuxtRequestEvent, RequestEvent, RuntimeConfig } from 'nuxt/schema'
import { useRuntimeConfig as _useRuntimeConfig } from 'nuxt/internal/server-runtime-config'

import { NUXT_ERROR_SIGNATURE, NuxtError, createError } from '../app/error'
import type { NuxtError as NuxtErrorContract } from '../app/types'

export { clearSession, getSession, updateSession, useSession } from './session'
export { deriveSecret } from './secret'
export type { Session, SessionConfig, SessionData, SessionEvent, SessionManager, SessionPassword, SessionUpdate } from './session'

export type { AppRouteRules, RequestEvent, RequestEventContext, ServerRoutes } from 'nuxt/schema'
export type { NuxtErrorDetails } from '../app/error'
export type { NuxtErrorJSON } from '../app/types'

/**
 * The request event in the shape the configured `server.builder` provides: h3's
 * `H3Event` under `@nuxt/nitro-server`. Returned by {@link toNuxtRequestEvent}.
 *
 * @since 4.6.0
 */
export type { NuxtRequestEvent } from 'nuxt/schema'

/**
 * A request handler, as {@link defineEventHandler} returns it.
 *
 * @since 4.6.0
 */
export type EventHandler<Result = unknown> = (event: RequestEvent) => Result

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
 * @since 4.6.0
 */
export function defineEventHandler<Result> (handler: EventHandler<Result>): EventHandler<Result> {
  return handler
}

/**
 * The event in the shape the configured `server.builder` provides, for calls the
 * helpers here do not cover. It is the same request, not a copy.
 *
 * @example
 * ```ts
 * // server/api/cors.ts
 * import { defineEventHandler, toNuxtRequestEvent } from 'nuxt/server'
 * import { handleCors } from 'nitro/h3'
 *
 * export default defineEventHandler((event) => {
 *   handleCors(toNuxtRequestEvent(event), { origin: '*' })
 *   return { ok: true }
 * })
 * ```
 *
 * @since 4.6.0
 */
export function toNuxtRequestEvent (event: RequestEvent): NuxtRequestEvent {
  return ((event as RequestEvent & { '~app'?: NuxtRequestEvent })['~app'] ?? event) as NuxtRequestEvent
}

export { createError, NuxtError }

type EventWithRequest = Pick<RequestEvent, 'req'>

/** `url` is optional because a runtime need not parse it up front; the request always carries it. */
type EventWithURL = EventWithRequest & { url?: URL }

type EventWithResponse = Pick<RequestEvent, 'res'>

/**
 * The shape shared by every HTTP error reachable in server code: the ones
 * {@link createError} constructs, and the ones the server runtime throws for
 * itself, which are not `NuxtError`s.
 *
 * @since 4.6.0
 */
export type NuxtErrorLike<DataT = unknown> = Error
  & Pick<NuxtErrorContract<DataT>, 'status'>
  & Partial<Pick<NuxtErrorContract<DataT>, 'statusText' | 'headers' | 'data' | 'unhandled'>>

/**
 * Whether a caught value is an HTTP error carrying a status.
 *
 * The check is structural, because the error may come from the server runtime
 * rather than from {@link createError}. h3 v2 names its errors `HTTPError`; h3
 * v1 marks the constructor instead.
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
 * @since 4.6.0
 */
export function isNuxtError<DataT = unknown> (error: unknown): error is NuxtErrorLike<DataT> {
  const candidate = error as { status?: unknown, constructor?: { __h3_error__?: unknown }, [NUXT_ERROR_SIGNATURE]?: unknown } | null | undefined
  if (!(error instanceof Error) || typeof candidate?.status !== 'number') {
    return false
  }
  return candidate[NUXT_ERROR_SIGNATURE] === true || error.name === 'HTTPError' || candidate.constructor?.__h3_error__ === true
}

/**
 * The URL of the incoming request.
 *
 * @since 4.6.0
 */
export function getRequestURL (event: EventWithURL): URL {
  return event.url ?? new URL(event.req.url)
}

/**
 * Read one request header, or `undefined` when it was not sent.
 *
 * Header names are case-insensitive.
 *
 * @since 4.6.0
 */
export function getRequestHeader (event: EventWithRequest, name: string): string | undefined {
  return event.req.headers.get(name) ?? undefined
}

/**
 * Read every request header, keyed by lowercased name.
 *
 * @since 4.6.0
 */
export function getRequestHeaders (event: EventWithRequest): Record<string, string> {
  return Object.fromEntries(event.req.headers)
}

/**
 * The dynamic segments matched for the request, as they appear in the URL:
 * percent-encoded, as `URLPattern` reports them. Set `decode` to decode them,
 * apart from encoded path separators (`%2F`, `%5C`), so a segment cannot be
 * read as a path it did not match.
 *
 * @example
 * ```ts
 * // server/api/users/[id].ts
 * export default defineEventHandler((event) => {
 *   const { id } = getRouterParams(event, { decode: true })
 *   return { id }
 * })
 * ```
 *
 * @since 4.6.0
 */
export function getRouterParams (event: Pick<RequestEvent, 'context'>, options: { decode?: boolean } = {}): Record<string, string | undefined> {
  const params = event.context.params || {}
  if (!options.decode) {
    return params
  }
  const decoded: Record<string, string | undefined> = {}
  for (const key in params) {
    const value = params[key]
    decoded[key] = value === undefined ? value : decodePreservingSeparators(value)
  }
  return decoded
}

/**
 * One dynamic segment matched for the request, or `undefined` when the route
 * has none of that name. See {@link getRouterParams}.
 *
 * @since 4.6.0
 */
export function getRouterParam (event: Pick<RequestEvent, 'context'>, name: string, options?: { decode?: boolean }): string | undefined {
  return getRouterParams(event, options)[name]
}

const ENCODED_SEPARATOR_RE = /%(?:25)*(?:2f|5c)/gi

function decodePreservingSeparators (value: string): string {
  if (!value.includes('%')) {
    return value
  }
  let result = ''
  let lastIndex = 0
  for (const match of value.matchAll(ENCODED_SEPARATOR_RE)) {
    result += decodeURIComponent(value.slice(lastIndex, match.index)) + match[0]
    lastIndex = match.index + match[0].length
  }
  return result + decodeURIComponent(value.slice(lastIndex))
}

/**
 * The IP address of the client, or `undefined` when it cannot be determined.
 *
 * By default no forwarded header is trusted: the address is the one the
 * server runtime reports for the connection, and a runtime that reports none
 * resolves `undefined`. Set `xForwardedFor` to read the first entry of the
 * `X-Forwarded-For` header instead, only behind a proxy you control that
 * overwrites that header; one that appends to it leaves a client-sent value
 * first.
 *
 * @since 4.6.0
 */
export function getRequestIP (event: EventWithRequest, options: { xForwardedFor?: boolean } = {}): string | undefined {
  if (options.xForwardedFor) {
    const forwarded = event.req.headers.get('x-forwarded-for')?.split(',')[0]!.trim()
    if (forwarded) {
      return forwarded
    }
  }
  const request = event.req as Request & { ip?: string, context?: { clientAddress?: string } }
  return request.context?.clientAddress || request.ip || undefined
}

/**
 * Set the status, and optionally the reason phrase, of the response.
 *
 * @since 4.6.0
 */
export function setResponseStatus (event: EventWithResponse, status: number, statusText?: string): void {
  const res = event.res
  res.status = status
  if (statusText !== undefined) {
    res.statusText = statusText
  }
}

/**
 * Set one response header, replacing any value already set for it.
 *
 * @since 4.6.0
 */
export function setResponseHeader (event: EventWithResponse, name: string, value: string): void {
  event.res.headers.set(name, value)
}

/**
 * Set several response headers, replacing any values already set for them.
 *
 * @since 4.6.0
 */
export function setResponseHeaders (event: EventWithResponse, headers: Record<string, string>): void {
  const target = event.res.headers
  for (const name in headers) {
    target.set(name, headers[name]!)
  }
}

/**
 * Read the query string of the request. A repeated parameter resolves to an
 * array, so a type parameter should account for that.
 *
 * @since 4.6.0
 */
export function getQuery<T extends Record<string, unknown> = Record<string, string | string[]>> (event: EventWithURL): T {
  return parseQuery(getRequestURL(event).search) as T
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
 * @since 4.6.0
 */
export async function readBody<T = unknown> (event: EventWithRequest): Promise<T> {
  const request = event.req
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
 * @since 4.6.0
 */
export function getCookie (event: EventWithRequest, name: string): string | undefined {
  const header = event.req.headers.get('cookie')
  return header ? parse(header)[name] : undefined
}

/**
 * Set a cookie on the response. Each call appends its own `Set-Cookie`
 * header, so several cookies may be set for one response.
 *
 * @since 4.6.0
 */
export function setCookie (event: EventWithResponse, name: string, value: string, options?: CookieSerializeOptions): void {
  event.res.headers.append('set-cookie', serialize(name, value, { path: '/', ...options }))
}

/**
 * Expire a cookie on the response. The `path` and `domain` must match those
 * it was set with, or the original cookie survives alongside the expired one.
 *
 * @since 4.6.0
 */
export function deleteCookie (event: EventWithResponse, name: string, options?: CookieSerializeOptions): void {
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
 * @since 4.6.0
 */
export function sendRedirect (event: EventWithResponse, location: string, status = 302): string {
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
 * @since 4.6.0
 */
export function getRouteRules (_event: Pick<RequestEvent, 'context'>): AppRouteRules {
  return {}
}

/**
 * The runtime configuration, including the keys only the server can read.
 *
 * @since 4.6.0
 */
export function useRuntimeConfig (): RuntimeConfig {
  return _useRuntimeConfig() as RuntimeConfig
}
