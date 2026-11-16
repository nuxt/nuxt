/**
 * What the handlers of this builder need from the renderer of the Nuxt version they are
 * built for, implemented for the Nuxt 4 renderer. Resolved as `#internal/nuxt/host`.
 */
import type { RendererContext } from 'vue-bundle-renderer/runtime'
import { normalizeViteManifest } from 'vue-bundle-renderer'
import { withoutBase } from 'ufo'
import type { QueryObject } from 'ufo'
import { mergeHeaders } from 'nuxt/internal/renderer/headers'
import { getRequestState } from 'nuxt/internal/renderer/runtime'
import type { NuxtRendererOptions, RendererEvent } from 'nuxt/internal/renderer/runtime'
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
 * The route rules the renderer is given for a request. h3 removes a rule set to `false`,
 * and the Nuxt 4 renderer only opts out of rendering on an explicit `ssr: false`.
 */
export function withRouteRuleDefaults<T extends object> (rules: T): T & { ssr: boolean } {
  return { ssr: false, ...rules }
}

/** Render a page, keeping the headers of a render that fails for the error response. */
export function renderPage (renderer: PageRenderer, event: RendererEvent): Promise<Response> {
  return renderer.fetch(event).catch(error => rethrowWithResponseHeaders(event, error))
}
