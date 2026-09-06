import { joinURL, withQuery } from 'ufo'
import { createHooks } from 'hookable'
import { SSR_ERROR_PARAM, encodeSSRError } from 'nuxt/internal/renderer/error'
import { createError, sendRedirect } from 'nuxt/server'
import type { NuxtRendererOptions, RendererHooks } from 'nuxt/internal/renderer/runtime'
import { buildAssetsURL, publicAssetsURL } from '#internal/nuxt/paths'

import { createRequestEvent } from './event.ts'

/** The renderer, as `createNuxtRenderer()` returns it. */
export interface NuxtRenderer {
  fetch: (event: ReturnType<typeof createRequestEvent>) => Promise<Response>
}

/** Route rules matched for a path, as the build's compiled matcher resolves them. */
export type MatchRouteRules = (path: string) => {
  ssr?: boolean
  streaming?: boolean
  noScripts?: boolean
  prerender?: boolean
  redirect?: { to: string, status?: number, base?: string } | false
  headers?: Record<string, string>
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
 * Route rules come from the matcher the build compiled, so a route is server-rendered
 * unless a rule says otherwise.
 */
export function createRendererOptions (runtimeConfig: NuxtRendererOptions['runtimeConfig'], matchRouteRules: MatchRouteRules, prerender?: NuxtRendererOptions['prerender']): NuxtRendererOptions {
  // the URL helpers the app build generates read these off the global
  ;(globalThis as { __buildAssetsURL?: unknown }).__buildAssetsURL = buildAssetsURL
  ;(globalThis as { __publicAssetsURL?: unknown }).__publicAssetsURL = publicAssetsURL

  return {
    runtimeConfig,
    buildAssetsURL,
    publicAssetsURL,
    getRouteRules: event => ({ ssr: true, ...matchRouteRules(event.url.pathname) }),
    hooks: () => serverHooks,
    createResponse: (body, init) => new Response(body, init),
    createError: init => createError(init),
    prerender,
    onRenderSuccess: import.meta.dev
      ? () => {
          import('./dev-error.ts').then(({ clearErrorReport }) => clearErrorReport()).catch(() => {})
        }
      : undefined,
  }
}

/**
 * Header the crawler reads additional routes from. The renderer collects them on the
 * request event, which does not cross the handler boundary, so they ride the response.
 */
const PRERENDER_HINTS_HEADER = 'x-nuxt-prerender'

/**
 * A web-standard handler over the renderer: it renders the request, and renders the app's
 * error page for a request the render refused.
 *
 * In development it also serves the live error channel, and publishes what it failed on
 * to it, so the error page carries a `my-bad` report.
 */
export function createFetchHandler (renderer: NuxtRenderer, matchRouteRules: MatchRouteRules): (request: Request) => Promise<Response> {
  return async function fetch (request: Request): Promise<Response> {
    if (import.meta.dev) {
      const devErrors = await import('./dev-error.ts')
      if (devErrors.isErrorChannelRequest(new URL(request.url).pathname)) {
        return devErrors.fetchErrorChannel(request)
      }
    }
    const event = createRequestEvent(request)
    const rules = matchRouteRules(event.url.pathname)
    if (rules.redirect) {
      return redirectResponse(event, rules.redirect, rules.headers)
    }
    try {
      const response = await renderer.fetch(event)
      applyHeaders(response, rules.headers)
      if (import.meta.prerender) {
        applyPrerenderHints(event, response)
      }
      return response
    } catch (error) {
      const response = await renderError(renderer, request, error, event)
      applyHeaders(response, rules.headers)
      if (import.meta.prerender) {
        applyPrerenderHints(event, response)
      }
      return response
    }
  }
}

function applyHeaders (response: Response, headers: Record<string, string> | undefined): void {
  for (const name in headers) {
    response.headers.set(name, headers[name]!)
  }
}

/**
 * Answer a `redirect` rule. A target carrying `**` moves a whole subtree: the tail of the
 * request past the prefix the rule matched under is interpolated into it. Targets naming a
 * parameter of the matched pattern are not resolved; those need a server runtime.
 */
function redirectResponse (event: ReturnType<typeof createRequestEvent>, redirect: { to: string, status?: number, base?: string }, headers: Record<string, string> | undefined): Response {
  let location = redirect.to
  if (location.includes('**')) {
    const path = event.url.pathname
    const tail = redirect.base && path.startsWith(redirect.base) ? path.slice(redirect.base.length) : path
    location = location.endsWith('/**')
      ? joinURL(location.slice(0, -3), tail)
      : location.replace('**', tail.replace(/^\//, ''))
  }
  const body = sendRedirect(event, appendSearch(location, event.url.search), redirect.status ?? 307)
  const response = new Response(body, { status: event.res.status, headers: event.res.headers })
  applyHeaders(response, headers)
  return response
}

/** Carry the request's query onto a redirect target, ahead of any fragment the target names. */
function appendSearch (target: string, search: string): string {
  if (!search) { return target }
  const hashIndex = target.indexOf('#')
  const path = hashIndex === -1 ? target : target.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : target.slice(hashIndex)
  const separator = !path.includes('?') ? '?' : path.endsWith('?') || path.endsWith('&') ? '' : '&'
  return path + separator + search.slice(1) + hash
}

function applyPrerenderHints (event: ReturnType<typeof createRequestEvent>, response: Response): void {
  const paths = (event.context as { nuxt?: { prerenderRoutes?: string[] } }).nuxt?.prerenderRoutes
  if (!paths?.length) { return }

  response.headers.append(PRERENDER_HINTS_HEADER, paths.map(path => encodeURIComponent(path)).join(', '))
}

async function renderError (renderer: NuxtRenderer, request: Request, error: unknown, event: ReturnType<typeof createRequestEvent>): Promise<Response> {
  const { status, statusText, message, headers } = describeError(error)
  const url = new URL(request.url)

  const devErrors = import.meta.dev ? await import('./dev-error.ts') : undefined
  const report = devErrors ? await devErrors.observeError(error, request, { expected: status < 500 }) : undefined

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
  // while prerendering the two renders share one state, so routes the error page asks
  // for are reported alongside those the failed render collected before it threw
  const state = (import.meta.prerender ? (event.context as { nuxt?: Record<string, unknown> }).nuxt : undefined) || {}
  state['~rendering-error'] = true
  if (devErrors) {
    // frames of the code that actually failed, for the app's own error page
    const cause = devErrors.errorCause(error)
    if (cause !== undefined) {
      state['~error-cause'] = cause
    }
  }
  ;(errorEvent.context as { nuxt?: Record<string, unknown> }).nuxt = state
  if (import.meta.prerender) {
    ;(event.context as { nuxt?: Record<string, unknown> }).nuxt = state
  }

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
