import { withQuery } from 'ufo'
import { createHooks } from 'hookable'
import { SSR_ERROR_PARAM, encodeSSRError } from 'nuxt/internal/renderer/error'
import { createError } from 'nuxt/server'
import type { NuxtRendererOptions, RendererHooks } from 'nuxt/internal/renderer/runtime'
import { buildAssetsURL, publicAssetsURL } from '#internal/nuxt/paths'

import { createRequestEvent } from './event.ts'

/** The renderer, as `createNuxtRenderer()` returns it. */
export interface NuxtRenderer {
  fetch: (event: ReturnType<typeof createRequestEvent>) => Promise<Response>
}

/**
 * Hooks the renderer calls while rendering. Without a server runtime there is no channel
 * for a module to register one at build time, so a custom server is the one that hooks in.
 */
export const serverHooks: RendererHooks = createHooks() as unknown as RendererHooks

/**
 * The capabilities `@nuxt/vite-server` provides to the renderer. Everything comes from the
 * platform or from values the build serialised, so the same options run on a node server
 * and in a web-standard worker.
 *
 * Route rules are not resolved: without a server runtime there is no matcher, so every
 * route is server-rendered and the build warns that the rules are ignored.
 */
export function createRendererOptions (runtimeConfig: NuxtRendererOptions['runtimeConfig']): NuxtRendererOptions {
  // the URL helpers the app build generates read these off the global
  ;(globalThis as { __buildAssetsURL?: unknown }).__buildAssetsURL = buildAssetsURL
  ;(globalThis as { __publicAssetsURL?: unknown }).__publicAssetsURL = publicAssetsURL

  return {
    runtimeConfig,
    buildAssetsURL,
    publicAssetsURL,
    getRouteRules: () => ({ ssr: true }),
    hooks: () => serverHooks,
    createResponse: (body, init) => new Response(body, init),
    createError: init => createError(init),
    onRenderSuccess: import.meta.dev
      ? () => {
          import('./dev-error.ts').then(({ clearErrorReport }) => clearErrorReport()).catch(() => {})
        }
      : undefined,
  }
}

/**
 * A web-standard handler over the renderer: it renders the request, and renders the app's
 * error page for a request the render refused.
 *
 * In development it also serves the live error channel, and publishes what it failed on
 * to it, so the error page carries a `my-bad` report.
 */
export function createFetchHandler (renderer: NuxtRenderer): (request: Request) => Promise<Response> {
  return async function fetch (request: Request): Promise<Response> {
    if (import.meta.dev) {
      const devErrors = await import('./dev-error.ts')
      if (devErrors.isErrorChannelRequest(new URL(request.url).pathname)) {
        return devErrors.fetchErrorChannel(request)
      }
    }
    const event = createRequestEvent(request)
    try {
      return await renderer.fetch(event)
    } catch (error) {
      return renderError(renderer, request, error)
    }
  }
}

async function renderError (renderer: NuxtRenderer, request: Request, error: unknown): Promise<Response> {
  const { status, statusText, message, headers } = describeError(error)
  const url = new URL(request.url)
  const isRenderingError = url.pathname.startsWith('/__nuxt_error')

  const devErrors = import.meta.dev ? await import('./dev-error.ts') : undefined
  const report = devErrors && !isRenderingError
    ? await devErrors.observeError(error, request, { expected: status < 500 })
    : undefined

  // a render that failed while rendering the error page cannot be recovered by rendering it again
  if (!isRenderingError) {
    const errorEvent = createRequestEvent(new Request(withQuery(new URL('/__nuxt_error', url).href, {
      [SSR_ERROR_PARAM]: encodeSSRError({
        status,
        statusText,
        message,
        fatal: false,
        url: request.url,
        data: (error as { data?: unknown })?.data,
        ...(import.meta.dev && { stack: (error as { stack?: string })?.stack }),
      }),
    }), { headers: request.headers }))
    const errorContext = { '~rendering-error': true } as Record<string, unknown>
    if (devErrors) {
      // frames of the code that actually failed, for the app's own error page
      const cause = devErrors.errorCause(error)
      if (cause !== undefined) {
        errorContext['~error-cause'] = cause
      }
    }
    ;(errorEvent.context as { nuxt?: Record<string, unknown> }).nuxt = errorContext

    const rendered = await renderer.fetch(errorEvent).catch(() => null)
    if (rendered) {
      const responseHeaders = new Headers(rendered.headers)
      for (const [name, value] of new Headers(headers)) {
        responseHeaders.set(name, value)
      }
      responseHeaders.set('content-type', 'text/html;charset=utf-8')
      if (devErrors && report && !import.meta.test) {
        const html = await rendered.text()
        // the overlay is a development aid; never let it replace the real error
        const body = await devErrors.overlayErrorReport(html, report).catch(() => html)
        return new Response(body, { status, statusText, headers: responseHeaders })
      }
      return new Response(rendered.body, { status, statusText, headers: responseHeaders })
    }

    if (devErrors && report) {
      const page = await devErrors.renderReportPage(report).catch(() => undefined)
      if (page) {
        return new Response(page, { status, statusText, headers: { ...headers, 'content-type': 'text/html;charset=utf-8' } })
      }
    }
  }

  return new Response(message, {
    status,
    statusText,
    headers: { ...headers, 'content-type': 'text/plain;charset=utf-8' },
  })
}

// a reason phrase is limited to HTAB / SP / VCHAR / obs-text, and `Response` throws on anything else
const INVALID_REASON_PHRASE_RE = /[^\t\x20-\x7E\x80-\xFF]/g

function describeError (error: unknown) {
  const { status, statusText, message, headers } = (error || {}) as { status?: number, statusText?: string, message?: string, headers?: unknown }
  const isHTTPError = typeof status === 'number' && status >= 400 && status <= 599
  // an error without a status is the server's own, whose message is only exposed in development
  const text = ((isHTTPError || import.meta.dev) && (statusText || message)) || (isHTTPError ? 'Request failed' : 'Internal Server Error')
  return {
    status: isHTTPError ? status : 500,
    statusText: text.replace(INVALID_REASON_PHRASE_RE, '') || 'Error',
    message: text,
    headers: headers instanceof Headers ? Object.fromEntries(headers) : (headers as Record<string, string> | undefined) ?? {},
  }
}
