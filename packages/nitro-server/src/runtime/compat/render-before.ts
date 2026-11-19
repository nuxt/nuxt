import type { H3Event } from 'nitro/h3'

import { fromLegacyBody } from './event.ts'
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
 * in place of the page by setting `response`, or render it differently by replacing `render`;
 * otherwise the page is rendered as usual.
 */
export async function applyLegacyRenderBefore (event: H3Event, hooks: LegacyHooks, renderPage: (event: H3Event) => Promise<Response>, createResponse: (body: BodyInit | null, init?: ResponseInit) => Response): Promise<Response> {
  const render = async (renderEvent: H3Event) => toLegacyRenderResponse(await renderPage(renderEvent))
  const context: LegacyRenderContext = { event, render, response: undefined }

  await hooks.callHook('render:before', context)

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

  const body = typeof response.body === 'string' ? fromLegacyBody(event, response.body) as string : (response.body ?? null) as BodyInit | null
  return createResponse(body, { status: event.res.status, statusText: event.res.statusText, headers: event.res.headers })
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
