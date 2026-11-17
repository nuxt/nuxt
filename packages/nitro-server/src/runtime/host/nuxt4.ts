/**
 * What the server runtime of this builder needs from the Nuxt version it is built for,
 * implemented for Nuxt 4. Resolved as `#internal/nuxt/host`.
 */
import type { RendererContext } from 'vue-bundle-renderer/runtime'
import { H3Event } from 'nitro/h3'
import type { ServerRequest } from 'srvx'
import { normalizeViteManifest } from 'vue-bundle-renderer'
import { withoutBase } from 'ufo'
import type { QueryObject } from 'ufo'
import { mergeHeaders } from 'nuxt/internal/renderer/headers'
import { getRequestState } from 'nuxt/internal/renderer/runtime'
import type { NuxtRendererOptions, RendererEvent } from 'nuxt/internal/renderer/runtime'
import { createRuntimeConfig as createCoreRuntimeConfig } from 'nuxt/internal/runtime-config'
import type { RuntimeConfigSchemaObject } from '@nuxt/schema/internal'
import type { NuxtPayload, SerializedErrorCause } from '#app/types'

import { withBaseURL } from '../utils/base'

export const NUXT_ERROR_SIGNATURE = '__nuxt_error'

export const docsVersion = '4.x'

type SSRError = NonNullable<NuxtPayload['error']> & { url: string }

/** The error a handler assembles for the error page to render. */
export type SSRErrorInput = {
  -readonly [K in 'status' | 'statusText' | 'message' | 'stack' | 'fatal']?: SSRError[K]
} & { url?: string, data?: unknown }

/** A response as the Nuxt 4 app queues it on `ssrContext['~renderResponse']`. */
export interface RenderedResponse {
  body?: unknown
  statusCode?: number
  statusMessage?: string
  headers?: Record<string, string>
}

export interface PageRenderer {
  fetch: (event: RendererEvent) => Promise<Response>
}

/** The query the renderer reads the error to render from, on `/__nuxt_error`. */
export function errorPageQuery (error: SSRErrorInput, cause?: SerializedErrorCause): QueryObject {
  const url = new URL(error.url || '/', 'http://localhost')
  return {
    ...error,
    url: withoutBase(url.pathname, withBaseURL('/')) + url.search + url.hash,
    data: encodeErrorData(error.data),
    ...(cause !== undefined && { cause: JSON.stringify(cause) }),
  } as QueryObject
}

function encodeErrorData (data: unknown): string | undefined {
  if (data === undefined || typeof data === 'string') { return data }
  try {
    return JSON.stringify(data)
  } catch {
    return undefined
  }
}

/** The response the app queued on `ssrContext['~renderResponse']`. */
export function toRenderResponse (options: NuxtRendererOptions, rendered: RenderedResponse | Response): Response {
  if (rendered instanceof Response) {
    return rendered
  }
  return options.createResponse((rendered.body ?? null) as BodyInit | null, {
    status: rendered.statusCode,
    statusText: rendered.statusMessage,
    headers: rendered.headers,
  })
}

export function returnRenderResponse (options: NuxtRendererOptions, event: RendererEvent, response: Response): Response {
  const headers = mergeHeaders(new Headers(event.res.headers), response.headers)
  return options.createResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function rethrowWithResponseHeaders (event: RendererEvent, error: unknown): never {
  const state = (event.context as { nuxt?: Record<string, unknown> }).nuxt ||= {}
  state['~response-headers'] = event.res.headers
  throw error
}

export function patchDevClientCss (event: RendererEvent, rendererContext: RendererContext): void {
  const css = getRequestState(event)?.['~devClientCss']
  if (!css?.length) { return }

  const current = rendererContext.manifest
  const entry = current?.['@vite/client']
  if (!entry) { return }

  rendererContext.updateManifest(normalizeViteManifest({ ...current, '@vite/client': { ...entry, css } }))
}

/**
 * The JSON error body sent with the legacy layer enabled, carrying the h3 v1 status keys a
 * Nuxt 4 app reads alongside the ones Nitro sets.
 */
export function toJSONErrorBody<T> (body: T): T {
  if (!body || typeof body !== 'object') {
    return body
  }
  const { status, statusText } = body as { status?: number, statusText?: string }
  return { ...body, statusCode: status, statusMessage: statusText }
}

/**
 * The route rules the renderer is given for a request. h3 removes a rule set to `false`,
 * and the Nuxt 4 renderer only opts out of rendering on an explicit `ssr: false`.
 */
export function withRouteRuleDefaults<T extends object> (rules: T): T & { ssr: boolean } {
  return { ssr: false, ...rules }
}

/**
 * Create `useRuntimeConfig` from the serialised runtime config. With `strictPaths`, only issues
 * with values at or below one of those paths stop the server, and the rest only warn.
 */
export const createRuntimeConfig: <T extends Record<string, any>>(config: T, schema: RuntimeConfigSchemaObject, strictPaths?: string[]) => () => T = createCoreRuntimeConfig

/**
 * The request state of a request the base URL middleware dispatches again without the base URL.
 * It keeps the URL the request arrived with, which the app reads as its request URL.
 */
export function baseURLDispatchState (event: RendererEvent): RequestURLState {
  return { '~internal': true, '~requestURL': event.url.href }
}

interface RequestURLState {
  '~internal'?: boolean
  '~requestURL'?: string
}

/**
 * Render a page, keeping the headers of a render that fails for the error response.
 *
 * The app reads the request URL with the base URL included, while the renderer reads it
 * relative to the base.
 */
export function renderPage (renderer: PageRenderer, event: RendererEvent): Promise<Response> {
  const url = requestURL(event)
  if (url !== event.url.href) {
    event['~app'] = withRequestURL(event, new URL(url))
  }
  return renderer.fetch(event).catch(error => rethrowWithResponseHeaders(event, error))
}

/** The URL the request arrived with, in the canonical form h3 gives `event.url`. */
function requestURL (event: RendererEvent): string {
  const dispatched = (event.context as { nuxt?: RequestURLState }).nuxt?.['~requestURL']
  if (dispatched) {
    return dispatched
  }
  const url = event.req.url
  return url === event.url.href ? url : new H3Event({ url } as ServerRequest).url.href
}

function withRequestURL (event: RendererEvent, url: URL): NonNullable<RendererEvent['~app']> {
  const path = event.url.pathname + event.url.search
  return Object.create(event, {
    url: { value: url, writable: true, enumerable: true, configurable: true },
    path: { value: path, writable: true, configurable: true },
    // h3 creates the response on first read, on the object it is read from
    res: { value: event.res, enumerable: true, configurable: true },
  })
}
