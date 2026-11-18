/**
 * h3 v1 helper surface implemented on h3 v2 (`nitro/h3`) primitives, without the v1
 * handler wrapper. The app's server build on a Nuxt 4 host resolves its h3 helpers to
 * this module, so it must not import Nitro's runtime.
 */
// the v1 helpers this module implements are deprecated in h3 v2 by definition
/* eslint-disable @typescript-eslint/no-deprecated */
import {
  handleCacheHeaders as _handleCacheHeaders,
  handleCors as _handleCors,
  proxyRequest as _proxyRequest,
  readBody as _readBody,
  readFormData as _readFormData,
  readMultipartFormData as _readMultipartFormData,
  readValidatedBody as _readValidatedBody,
  iterable,
  noContent,
  proxy,
  redirect,
} from 'nitro/h3'
import type { H3Event, HTTPResponse } from 'nitro/h3'
import { destr } from 'destr'

import { createError, toLegacyError } from './error-shape.ts'
import type { H3ErrorInput } from './error-shape.ts'
import { endResponse } from './ended-response.ts'

export { createError, toLegacyError, withLegacyErrorShape } from './error-shape.ts'
export type { H3ErrorInput } from './error-shape.ts'

export * from 'nitro/h3'

const kRawBody = Symbol.for('nuxt.compat.rawBody')
const kParsedBody = Symbol.for('nuxt.compat.parsedBody')

/**
 * The request body, buffered once per request from a clone so that the request the
 * route handler receives is still readable. h3 v1 cached the parsed body on the event and
 * every later read reused it; under h3 v2 the request drains on first read, so a middleware
 * reading the body would otherwise leave the route with nothing.
 *
 * The whole body is buffered for the lifetime of the request, which for a large upload
 * costs its size in memory.
 */
function readBufferedBody (event: H3Event): Promise<ArrayBuffer> {
  const context = event.context as Record<symbol, any>
  if (!context[kRawBody]) {
    const request = event.req
    // cloned before any read: the clone drains, the original keeps its stream
    context[kRawBody] = new Promise<ArrayBuffer>(resolve => resolve((typeof request.clone === 'function' ? request.clone() : request).arrayBuffer()))
  }
  return context[kRawBody]
}

/** The event with a fresh, readable request built from the buffered body. */
async function withReplayedBody (event: H3Event): Promise<H3Event> {
  const buffer = await readBufferedBody(event)
  const request = new Request(event.req.url, {
    method: event.req.method,
    headers: event.req.headers,
    body: buffer.byteLength > 0 ? buffer : undefined,
  })
  return Object.create(event, { req: { value: request, enumerable: true } }) as H3Event
}

const PAYLOAD_METHODS = new Set(['PATCH', 'POST', 'PUT', 'DELETE'])

/** The error v1 body readers reject a request with when its method carries no payload. */
function getMethodError (event: H3Event) {
  if (!PAYLOAD_METHODS.has(event.req.method.toUpperCase())) {
    return createError({ statusCode: 405, statusMessage: 'HTTP method is not allowed.' })
  }
}

interface ReadBodyOptions {
  /** Reject a body that is not valid JSON, rather than returning its text. */
  strict?: boolean
  type?: 'json' | 'text' | 'formData' | 'urlencoded'
}

/**
 * v1 `readBody`, reading a replayable copy of the body and caching the parsed result.
 *
 * Without a `type`, a `text/*` body is returned as text, a urlencoded body as an object,
 * and any other body is parsed as JSON. Parsing is strict for `application/json` and
 * otherwise falls back to the text, unless `strict` says otherwise. The first successful
 * parse is returned to every later read without a `type`, whatever its `strict`.
 */
export function readBody<T = any> (event: H3Event, options?: ReadBodyOptions): Promise<T> {
  const methodError = getMethodError(event)
  if (methodError) {
    return Promise.reject(methodError)
  }
  const context = event.context as Record<symbol, any>
  const cache: Map<string, Promise<any>> = context[kParsedBody] ||= new Map()
  const type = options?.type
  const key = type || 'auto'
  if (!cache.has(key)) {
    const parsed = type
      ? withReplayedBody(event).then(replayed => _readBody(replayed, { type } as any))
      : parseBody(event, options?.strict)
    cache.set(key, parsed)
    parsed.catch(() => {
      if (cache.get(key) === parsed) {
        cache.delete(key)
      }
    })
  }
  return cache.get(key)!
}

async function parseBody (event: H3Event, strict?: boolean): Promise<any> {
  const contentType = (event.req.headers.get('content-type') || '').toLowerCase()
  if (contentType.startsWith('application/x-www-form-urlencoded')) {
    return _readBody(await withReplayedBody(event), { type: 'urlencoded' } as any)
  }
  const text: string | undefined = await readRawBody(event)
  if (!text || contentType.startsWith('text/')) {
    return text
  }
  try {
    return destr(text, { strict: strict ?? contentType === 'application/json' })
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Invalid JSON body' })
  }
}

/** v1 `readRawBody`, which returned `undefined` when there was no body. */
export async function readRawBody (event: H3Event, encoding: 'utf8' | false = 'utf8'): Promise<any> {
  const methodError = getMethodError(event)
  if (methodError) {
    throw methodError
  }
  const buffer = await readBufferedBody(event)
  if (buffer.byteLength === 0) {
    return undefined
  }
  return encoding ? new TextDecoder().decode(buffer) : new Uint8Array(buffer)
}

export async function readFormData (event: H3Event): Promise<FormData> {
  return _readFormData(await withReplayedBody(event))
}

export const readFormDataBody = readFormData

export async function readMultipartFormData (event: H3Event): ReturnType<typeof _readMultipartFormData> {
  return _readMultipartFormData(await withReplayedBody(event))
}

/** v1 `readValidatedBody`, validating the body as a strict `readBody` reads it unless a `type` is given. */
export async function readValidatedBody<T> (event: H3Event, validate: (data: unknown) => T | Promise<T>, options?: { type?: 'json' | 'text' | 'formData' | 'urlencoded' }): Promise<T> {
  const methodError = getMethodError(event)
  if (methodError) {
    throw methodError
  }
  if (options?.type) {
    return _readValidatedBody(await withReplayedBody(event), validate as any, options as any) as Promise<T>
  }
  const body = await readBody(event, { strict: true })
  return _readValidatedBody(withJSONBody(event, body), validate as any) as Promise<T>
}

/** The event with a request carrying `value` as its JSON body, for an h3 helper that parses the body itself. */
function withJSONBody (event: H3Event, value: unknown): H3Event {
  const request = new Request(event.req.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: value === undefined ? undefined : JSON.stringify(value),
  })
  return Object.create(event, { req: { value: request, enumerable: true } }) as H3Event
}

/** v1 `getRequestWebStream`, streaming the buffered body rather than the live request. */
export function getRequestWebStream (event: H3Event): ReadableStream | undefined {
  if (!event.req.body) {
    return undefined
  }
  return new ReadableStream<Uint8Array>({
    async start (controller) {
      const buffer = await readBufferedBody(event)
      if (buffer.byteLength > 0) {
        controller.enqueue(new Uint8Array(buffer))
      }
      controller.close()
    },
  })
}

export const getBodyStream = getRequestWebStream

/** v1 `toWebRequest`, a copy of the request whose body is the buffered body. */
export function toWebRequest (event: H3Event): Request {
  const body = getRequestWebStream(event)
  return new Request(event.req.url, {
    method: event.req.method,
    headers: event.req.headers,
    body,
    ...body && { duplex: 'half' },
  } as RequestInit)
}

export const MIMES = {
  html: 'text/html',
  json: 'application/json',
}

/** v1 `sendError`, which sets the status and responds with the serialised error. */
export function sendError (event: H3Event, error: Error | H3ErrorInput, debug?: boolean): string {
  const httpError = toLegacyError(error)
  event.res.status = httpError.status
  event.res.statusText = httpError.statusText
  event.res.headers.set('content-type', MIMES.json)
  return endResponse(event, JSON.stringify({
    ...httpError.toJSON(),
    stack: debug && httpError.stack ? httpError.stack.split('\n').map(line => line.trim()) : undefined,
  }))
}

/** v1 `sendRedirect`, which set the status and `location` header on the event as well as returning a response. */
export function sendRedirect (event: H3Event, location: string, code = 302): any {
  event.res.status = code
  event.res.headers.set('location', location)
  return endResponse(event, redirect(location, code))
}

/** v1 `send`. Sets an optional content type and responds with the body. */
export function send (event: H3Event, data?: any, type?: string): any {
  if (type) {
    event.res.headers.set('content-type', type)
  }
  return endResponse(event, data ?? '')
}

/** v1 `sendNoContent`, which keeps a status the handler set unless given one. */
export function sendNoContent (event: H3Event, code?: number): HTTPResponse {
  const status = event.res.status && event.res.status !== 200 ? event.res.status : 204
  return endResponse(event, noContent(code || status))
}

export function sendStream<T> (event: H3Event, stream: T): T {
  return endResponse(event, stream)
}

export function sendWebResponse (event: H3Event, response: Response): Response {
  return endResponse(event, response)
}

export async function sendIterable (event: H3Event, value: Parameters<typeof iterable>[0], options?: Parameters<typeof iterable>[1]): Promise<HTTPResponse> {
  return endResponse(event, await iterable(value, options))
}

export async function sendProxy (event: H3Event, target: string, options?: Parameters<typeof proxy>[2]): Promise<HTTPResponse> {
  return endResponse(event, await proxy(event, target, options))
}

export async function proxyRequest (event: H3Event, target: string, options?: Parameters<typeof _proxyRequest>[2]): Promise<HTTPResponse> {
  return endResponse(event, await _proxyRequest(event, target, options))
}

/** v1 `handleCacheHeaders`, which responds with `304 Not Modified` when the request matches. */
export function handleCacheHeaders (event: H3Event, options: Parameters<typeof _handleCacheHeaders>[1]): boolean {
  if (!_handleCacheHeaders(event, options)) {
    return false
  }
  endResponse(event, noContent(304))
  return true
}

/**
 * v1 `handleCors`, which responds to a preflight request with the preflight response. Returns
 * that response, which is truthy, for a preflight request and `false` for any other.
 */
export function handleCors (event: H3Event, options: Parameters<typeof _handleCors>[1]): HTTPResponse | false {
  const preflight = _handleCors(event, options)
  return preflight && endResponse(event, preflight)
}

export function isStream (input: any): boolean {
  return !!input && typeof input === 'object' && (typeof input.pipe === 'function' || typeof input.pipeTo === 'function')
}

export function isWebResponse (input: any): boolean {
  return input instanceof Response
}

const COOKIE_SPLIT_RE = /,(?=[^;,]*=)|,$/

/** v1 `splitCookiesString`, for callers forwarding a combined `set-cookie` header. */
export function splitCookiesString (cookiesString: string | string[]): string[] {
  if (Array.isArray(cookiesString)) {
    return cookiesString.flatMap(c => splitCookiesString(c))
  }
  return typeof cookiesString === 'string'
    ? cookiesString.split(COOKIE_SPLIT_RE).map(c => c.trim()).filter(Boolean)
    : []
}

export function defineRequestMiddleware<T> (input: T): T {
  return input
}

export function defineResponseMiddleware<T> (input: T): T {
  return input
}
