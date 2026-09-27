/**
 * h3 v1 helper surface implemented on h3 v2 (`nitro/h3`) primitives. Server code written
 * for h3 v1 resolves `h3` to this module.
 *
 * Absent, because they leak node or plain internals h3 v2 does not model: `H3Headers`,
 * `H3Response`, `createEvent`, `fromPlainHandler`, `toPlainHandler`,
 * `promisifyNodeListener`, `callNodeListener`, `createAppEventHandler`.
 */
// the v1 helpers this module implements are deprecated in h3 v2 by definition
/* eslint-disable @typescript-eslint/no-deprecated */
import {
  readBody as _readBody,
  readFormData as _readFormData,
  readMultipartFormData as _readMultipartFormData,
  readValidatedBody as _readValidatedBody,
  defineHandler,
  redirect,
} from 'nitro/h3'
import type { H3Event } from 'nitro/h3'

import { prepareLegacyEvent } from './event.ts'
import { toLegacyError } from './error-shape.ts'
import type { H3ErrorInput } from './error-shape.ts'

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
function readBufferedBody (event: H3Event): Promise<ArrayBuffer | undefined> {
  const context = event.context as Record<symbol, any>
  if (!context[kRawBody]) {
    const request = event.req
    if (request.bodyUsed) {
      return Promise.resolve(undefined)
    }
    // cloned before any read: the clone drains, the original keeps its stream
    context[kRawBody] = (typeof request.clone === 'function' ? request.clone() : request)
      .arrayBuffer()
      .catch(() => undefined)
  }
  return context[kRawBody]
}

/** The event with a fresh, readable request built from the buffered body. */
async function withReplayedBody (event: H3Event): Promise<H3Event> {
  const buffer = await readBufferedBody(event)
  const request = new Request(event.req.url, {
    method: event.req.method,
    headers: event.req.headers,
    body: buffer && buffer.byteLength > 0 ? buffer : undefined,
  })
  return Object.create(event, { req: { value: request, enumerable: true } }) as H3Event
}

/** v1 `readBody`, reading a replayable copy of the body and caching the parsed result. */
export function readBody<T = any> (event: H3Event, options?: { type?: 'json' | 'text' | 'formData' | 'urlencoded' }): Promise<T> {
  const context = event.context as Record<symbol, any>
  const cache: Map<string, Promise<any>> = context[kParsedBody] ||= new Map()
  const key = options?.type || 'auto'
  if (!cache.has(key)) {
    cache.set(key, withReplayedBody(event).then(replayed => _readBody(replayed, options as any)))
  }
  return cache.get(key)!
}

/** v1 `readRawBody`, which returned `undefined` when there was no body. */
export async function readRawBody (event: H3Event, encoding: 'utf8' | false = 'utf8'): Promise<any> {
  const buffer = await readBufferedBody(event)
  if (!buffer || buffer.byteLength === 0) {
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

export async function readValidatedBody<T> (event: H3Event, validate: (data: unknown) => T | Promise<T>, options?: { type?: 'json' | 'text' | 'formData' | 'urlencoded' }): Promise<T> {
  return _readValidatedBody(await withReplayedBody(event), validate as any, options as any) as Promise<T>
}

/** v1 `getRequestWebStream`, streaming the buffered body rather than the live request. */
export function getRequestWebStream (event: H3Event): ReadableStream | undefined {
  if (!event.req.body) {
    return undefined
  }
  return new ReadableStream<Uint8Array>({
    async start (controller) {
      const buffer = await readBufferedBody(event)
      if (buffer && buffer.byteLength > 0) {
        controller.enqueue(new Uint8Array(buffer))
      }
      controller.close()
    },
  })
}

export const getBodyStream = getRequestWebStream

export const MIMES = {
  html: 'text/html',
  json: 'application/json',
}

/**
 * v1 `sendError`. h3 v2 has no imperative response writer, so this sets the status and
 * returns the serialised body; `return sendError(event, err)` is the supported usage.
 */
export function sendError (event: H3Event, error: Error | H3ErrorInput, debug?: boolean): string {
  const httpError = toLegacyError(error)
  event.res.status = httpError.status
  event.res.statusText = httpError.statusText
  event.res.headers.set('content-type', MIMES.json)
  return JSON.stringify({
    ...httpError.toJSON(),
    stack: debug && httpError.stack ? httpError.stack.split('\n').map(line => line.trim()) : undefined,
  })
}

/** v1 `sendRedirect`, which set the status and `location` header on the event as well as returning a response. */
export function sendRedirect (event: H3Event, location: string, code = 302): any {
  event.res.status = code
  event.res.headers.set('location', location)
  return redirect(location, code)
}

/** v1 `send`. Sets an optional content type and returns the body. */
export function send (event: H3Event, data?: any, type?: string): any {
  if (type) {
    event.res.headers.set('content-type', type)
  }
  return data ?? ''
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

type LegacyHandlerObject = {
  handler: (event: H3Event) => any
  onRequest?: ((event: H3Event) => any) | Array<(event: H3Event) => any>
  onBeforeResponse?: ((event: H3Event, response: { body?: any }) => any) | Array<(event: H3Event, response: { body?: any }) => any>
  [key: string]: any
}

function toArray<T> (input: T | T[] | undefined): T[] {
  return input === undefined ? [] : Array.isArray(input) ? input : [input]
}

/**
 * v1 `defineEventHandler`, including the object form with `onRequest` /
 * `onBeforeResponse` hooks, which h3 v2 no longer accepts. The returned handler prepares
 * the v1 event shape and normalises thrown errors, so it needs no entry-level wrapper.
 */
export function defineEventHandler (input: ((event: H3Event) => any) | LegacyHandlerObject): any {
  const handler = typeof input === 'function' ? input : input.handler
  const rest: Partial<LegacyHandlerObject> = typeof input === 'function' ? {} : { ...input }
  delete rest.handler
  const onRequestHooks = toArray(typeof input === 'function' ? undefined : input.onRequest)
  const onBeforeResponseHooks = toArray(typeof input === 'function' ? undefined : input.onBeforeResponse)
  delete rest.onRequest
  delete rest.onBeforeResponse

  return defineHandler({
    ...rest,
    async handler (event: H3Event) {
      prepareLegacyEvent(event)
      try {
        for (const hook of onRequestHooks) {
          await hook(event)
        }
        const response = { body: await handler(event) }
        for (const hook of onBeforeResponseHooks) {
          await hook(event, response)
        }
        return response.body
      } catch (error) {
        throw toLegacyError(error)
      }
    },
  })
}

export const eventHandler = defineEventHandler
