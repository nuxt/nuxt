import type { NuxtPayload } from '#app/types'
import { NUXT_PRERENDER_ERROR_PAGES, PARSE_ERROR_DATA } from 'nuxt/internal/renderer-config'

import { describeError, isExpectedError, stringifyErrorData } from './error'
import type { DescribedError } from './error'
import type { DevErrorReport } from '../dev-error'
import { mergeHeaders } from './headers'
import { urlHash } from './url'
import type { NuxtRendererOptions, RenderedResponse, RendererEvent } from './runtime'

/** The error `error.vue` renders, as it travels through the payload. */
export type SSRError = NuxtPayload['error'] & { url: string }

/**
 * Answer a failed render with the app's own error page, rendered on the same event so the
 * headers and cookies the failed render wrote survive. There is one attempt: an error page
 * that throws is answered with the static template, carrying the status the app failed with.
 */
export async function renderErrorResponse (runtime: NuxtRendererOptions, event: RendererEvent, error: unknown, render: (ssrError: SSRError) => Promise<RenderedResponse>): Promise<Response> {
  const described = describeError(error)

  await captureError(runtime, event, error)
  const devError = import.meta.dev
    ? await runtime.onDevError?.(error, event, { expected: isExpectedError(error, described) }).catch(() => undefined)
    : undefined

  // the failed render shares this event, so its status line must not outlive it
  event.res.status = 200
  event.res.statusText = ''

  let rendered: RenderedResponse
  try {
    rendered = await render(await toSSRError(described, error, event))
  } catch (nested) {
    await captureError(runtime, event, nested, ['error-page'])
    return staticErrorResponse(runtime, event, described, devError)
  }

  const headers = new Headers(event.res.headers)
  for (const name in rendered.headers) {
    headers.set(name, rendered.headers[name]!)
  }
  mergeHeaders(headers, described.headers)
  headers.set('content-type', 'text/html;charset=utf-8')

  let body = (rendered.chunks ? rendered.chunks.join('') : rendered.body ?? null) as BodyInit | null
  if (import.meta.dev && devError && !import.meta.test) {
    const html = typeof body === 'string' ? body : await new Response(body).text()
    // the overlay is a development aid; never let it replace the real error
    body = await devError.overlay(html).catch(() => html)
  }

  // a redirect from the error page carries its own status; anything else answers with the error's
  const status = rendered.statusCode ?? event.res.status
  return runtime.createResponse(body, {
    status: status && status !== 200 ? status : described.status,
    statusText: rendered.statusMessage || described.statusText,
    headers,
  })
}

/** Hand the error to the server runtime's error sink, which must never replace the error. */
export async function captureError (runtime: NuxtRendererOptions, event: RendererEvent, error: unknown, tags?: string[]): Promise<void> {
  try {
    await runtime.captureError?.(error, { event, tags })
  } catch {
    // a sink that throws has nothing left to report it through
  }
}

/** The error page of last resort, for when the app's own error page cannot render either. */
async function staticErrorResponse (runtime: NuxtRendererOptions, event: RendererEvent, described: DescribedError, devError: DevErrorReport | undefined): Promise<Response> {
  const headers = mergeHeaders(new Headers(event.res.headers), described.headers)
  headers.set('content-type', 'text/html;charset=utf-8')
  const init = { status: described.status, statusText: described.statusText, headers }

  if (import.meta.dev && devError) {
    const page = await devError.page().catch(() => undefined)
    if (page) {
      return runtime.createResponse(page, init)
    }
  }

  const { template } = await import('./error-template')
  return runtime.createResponse(template({
    status: described.status,
    statusText: described.statusText,
    ...(import.meta.dev && { description: described.message }),
  }), init)
}

/** The caught error in the shape `error.vue` receives through the payload. */
async function toSSRError (described: DescribedError, error: unknown, event: RendererEvent): Promise<SSRError> {
  const candidate = (error || {}) as { fatal?: boolean, unhandled?: boolean, stack?: string, cause?: unknown }
  const ssrError = {
    status: described.status,
    statusText: described.statusText,
    statusMessage: described.statusText,
    message: described.message,
    data: PARSE_ERROR_DATA ? described.data : stringifyErrorData(described.data),
    fatal: candidate.fatal ?? false,
    unhandled: candidate.unhandled,
    url: event.url.pathname + event.url.search + urlHash(event.url),
    ...(import.meta.dev && { stack: candidate.stack }),
  } as unknown as SSRError

  if (import.meta.dev && candidate.cause !== undefined) {
    const { serializeErrorCause } = await import('nuxt/internal/dev-error')
    ;(ssrError as { cause?: unknown }).cause = serializeErrorCause(candidate.cause)
  }

  return ssrError
}

const ERROR_PAGE_RE = /^\/(\d{3})\.html$/
const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Page Not Found',
  410: 'Gone',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
}

/** The status of a static error page (`404.html` etc.) the build prerenders. */
export function isPrerenderedErrorPage (pathname: string): number | undefined {
  const status = Number(ERROR_PAGE_RE.exec(pathname)?.[1])
  return status && (NUXT_PRERENDER_ERROR_PAGES as number[]).includes(status) ? status : undefined
}

/**
 * Synthesise the error a static error page renders with, so the page is server-rendered at
 * build time rather than written out as an empty SPA shell.
 */
export function getPrerenderedErrorPage (event: RendererEvent): SSRError | null {
  const pathname = event.url.pathname
  const status = isPrerenderedErrorPage(pathname)
  if (!status) { return null }

  const statusText = STATUS_TEXT[status] || 'Error'
  return {
    status,
    statusText,
    message: statusText,
    fatal: false,
    url: pathname,
  } as SSRError
}
