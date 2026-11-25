import { toResponse } from 'nitro/h3'
import type { H3Event } from 'nitro/h3'

import { rethrowWithResponseHeaders } from '#internal/nuxt/host'
import { toLegacyError } from './error-shape.ts'
import { fromLegacyBody } from './event.ts'
import { getEndedResponse } from './ended-response.ts'
import { isStreamedResponse } from './render-response.ts'

interface LegacyHooks {
  callHook: (name: any, ...args: any[]) => unknown
}

/** A response as nitro v2 render handlers and `render:before` listeners describe it. */
interface LegacyRenderResponse {
  body?: unknown
  statusCode?: number
  statusMessage?: string
  headers?: Record<string, string | string[] | number | undefined>
}

/** The context nitro v2 passed to `render:before`. */
interface LegacyRenderContext {
  event: H3Event
  render: (event: H3Event) => Promise<LegacyRenderResponse>
  response?: LegacyRenderResponse
}

/**
 * Emit the nitro v2 `render:before` runtime hook before a page renders. A listener can respond
 * in place of the page by setting `response` or by ending the response with an h3 v1 helper, or
 * render it differently by replacing `render`; otherwise the page is rendered as usual.
 */
export async function applyLegacyRenderBefore (event: H3Event, hooks: LegacyHooks, renderPage: (event: H3Event) => Promise<Response>, createResponse: (body: BodyInit | null, init?: ResponseInit) => Response): Promise<Response> {
  const render = async (renderEvent: H3Event) => toLegacyRenderResponse(await renderPage(renderEvent))
  const context: LegacyRenderContext = { event, render, response: undefined }

  await hooks.callHook('render:before', context)

  if (getEndedResponse(event) !== undefined) {
    const ended = fromLegacyBody(event, undefined)
    return ended instanceof Response ? createResponse(...fromWebResponse(event, ended)) : toResponse(ended, event)
  }

  if (!context.response && context.render === render) {
    return renderPage(event)
  }

  const response = context.response ?? await context.render(event)
  if (!response) {
    const status = event.res.status && event.res.status !== 200 ? event.res.status : 500
    return createResponse(`No response returned from render handler: ${event.url.pathname + event.url.search}`, { status, headers: event.res.headers })
  }
  for (const [name, value] of Object.entries(response.headers || {})) {
    if (value === undefined) {
      continue
    }
    event.res.headers.delete(name)
    for (const entry of Array.isArray(value) ? value : [value]) {
      event.res.headers.append(name, String(entry))
    }
  }
  if (response.statusCode) {
    event.res.status = response.statusCode
  }
  if (response.statusMessage) {
    event.res.statusText = response.statusMessage
  }

  if (response.body instanceof Error) {
    rethrowWithResponseHeaders(event, toLegacyError(response.body))
  }
  if (response.body instanceof Response) {
    return createResponse(...fromWebResponse(event, response.body))
  }

  const body = response.body !== null && NULL_BODY_STATUSES.has(event.res.status ?? 200) ? null : toResponseBody(event, response.body)
  return createResponse(body, { status: event.res.status, statusText: event.res.statusText, headers: event.res.headers })
}

const NULL_BODY_STATUSES = new Set([204, 205, 304])

function fromWebResponse (event: H3Event, response: Response): [BodyInit | null, ResponseInit] {
  for (const [name, value] of response.headers) {
    if (name !== 'set-cookie') {
      event.res.headers.set(name, value)
    }
  }
  for (const cookie of response.headers.getSetCookie()) {
    event.res.headers.append('set-cookie', cookie)
  }
  if (response.redirected) {
    event.res.headers.set('location', response.url)
  }
  return [response.body, { status: response.status, statusText: response.statusText || event.res.statusText, headers: event.res.headers }]
}

function toResponseBody (event: H3Event, body: unknown): BodyInit | null {
  if (body === undefined) {
    return null
  }
  if (body === null) {
    if (!event.res.status || event.res.status === 200) {
      event.res.status = 204
    }
    if (event.res.status === 204) {
      event.res.headers.delete('content-length')
    }
    return null
  }
  if (typeof body === 'string') {
    return fromLegacyBody(event, body) as string
  }
  if (typeof body === 'object' && isBodyInit(body)) {
    return body as BodyInit
  }
  if (event.res.status !== 304 && !event.res.headers.has('content-type')) {
    event.res.headers.set('content-type', 'application/json')
  }
  return typeof body === 'bigint' ? body.toString() : JSON.stringify(body)
}

function isBodyInit (body: object): boolean {
  return ArrayBuffer.isView(body) || body instanceof ArrayBuffer || body instanceof Blob || body instanceof ReadableStream
    || body instanceof FormData || body instanceof URLSearchParams || typeof (body as { pipe?: unknown }).pipe === 'function'
}

async function toLegacyRenderResponse (response: Response): Promise<LegacyRenderResponse> {
  const headers: Record<string, string | string[]> = Object.fromEntries(response.headers)
  const cookies = response.headers.getSetCookie()
  if (cookies.length > 0) {
    headers['set-cookie'] = cookies
  }
  return {
    body: isStreamedResponse(response) ? response.body : await response.text(),
    statusCode: response.status,
    statusMessage: response.statusText || undefined,
    headers,
  }
}
