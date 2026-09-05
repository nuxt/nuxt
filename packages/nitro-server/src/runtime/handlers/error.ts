import { withQuery } from 'ufo'
import type { NitroErrorHandler } from 'nitro/types'
import type { SerializedErrorCause } from '#app/types'
import type { H3Event } from 'nitro/h3'
import { HTTPError } from 'nitro/h3'
import type { ErrorReport } from 'my-bad'
import { serverFetch } from 'nitro'
import { useNitroApp } from 'nitro/app'

import type { SSRErrorInput } from '../utils/error'
import { SSR_ERROR_PARAM, encodeSSRError, isJsonRequest } from '../utils/error'
import { withBaseURL } from '../utils/base'

export default <NitroErrorHandler> async function errorhandler (error, event, { defaultHandler }) {
  // Whether we are already rendering an error page. Such an inner failure has
  // already been logged and published by the outer request.
  const isRenderingError = (event as H3Event).url?.pathname.startsWith('/__nuxt_error') || !!(event as H3Event).context.nuxt?.['~rendering-error']

  let report: ErrorReport | undefined
  if (import.meta.dev) {
    const errorChannel = await import('../utils/error-channel')
    // a handled client error (a 404, a failed validation) is the app working as
    // intended rather than something to report, so it gets no report, no
    // overlay and no channel update
    const isExpected = !error.unhandled && HTTPError.isError(error) && (error.status || 500) < 500
    // the report maps positions itself, so it reads the stack as raised; the
    // stack is mapped afterwards for the JSON body, the log and `error.vue`
    report = isExpected ? undefined : await errorChannel.createErrorReport(error, event as H3Event).catch(() => undefined)
    mapSSRStacktrace(error)
    // a dev server that owns the channel prints the reports it is sent
    if (report && !isRenderingError && !errorChannel.shouldForwardReports() && (error.unhandled ?? !HTTPError.isError(error))) {
      const rendered = await errorChannel.renderErrorAnsi(report).catch(() => undefined)
      if (rendered) {
        console.log(`[request error] [${event.req.method}] ${event.req.url}\n\n${rendered}`)
      } else {
        console.error(`[request error] [${event.req.method}] ${event.req.url}\n\n`, error)
      }
    }
  }

  // invoke default Nitro error handler (which will log appropriately if required)
  const defaultRes = await defaultHandler(error, event, { json: true, silent: import.meta.dev && !!report })

  // return Nitro response + our headers for redirects and JSON responses
  const status = error.status || 500
  const headers = new Headers(error.headers)
  appendVary(headers, 'accept, sec-fetch-mode')
  if (isJsonRequest(event) || (status === 404 && defaultRes.status === 302)) {
    const setCookies = new Set(headers.getSetCookie())
    const headerEntries = [
      new Headers(defaultRes.headers),
      ...('res' in event ? [(event.res as Response).headers.entries()] : []),
    ]
    for (const entries of headerEntries) {
      mergeHeaders(headers, entries, setCookies)
    }

    return new Response(typeof defaultRes.body === 'string' ? defaultRes.body : JSON.stringify(defaultRes.body, null, 2), {
      headers,
      status: defaultRes.status,
      statusText: defaultRes.statusText,
    })
  }

  if (import.meta.dev && defaultRes.body && typeof defaultRes.body !== 'string' && Array.isArray(defaultRes.body.stack)) {
    // normalize to string format expected by nuxt `error.vue`
    defaultRes.body.stack = defaultRes.body.stack.join('\n')
  }

  const errorObject = (defaultRes.body || {}) as SSRErrorInput
  if (!error.unhandled) {
    errorObject.data ??= error.data
  }
  errorObject.url = event.req.url
  // `fatal` is Nuxt-only, so Nitro's error body does not carry it
  errorObject.fatal = (error as { fatal?: boolean }).fatal ?? false
  const errorCause = import.meta.dev ? serializeErrorCause(error.cause) : undefined

  // Merge defaultRes headers, skipping content-type (would be application/json)
  // and content-security-policy (would disable JS execution in the error page)
  mergeHeaders(headers, new Headers(defaultRes.headers), new Set(), IGNORED_ERROR_HEADERS)

  // Skip SSR error rendering if we're already inside one, to avoid recursion.
  if (!isRenderingError) {
    const eventContext = (event as H3Event).context
    eventContext.nuxt ||= {}
    eventContext.nuxt['~rendering-error'] = true
  }

  // HTML response (via SSR)
  const res = !isRenderingError && await serverFetch(
    withQuery(withBaseURL('/__nuxt_error'), { [SSR_ERROR_PARAM]: encodeSSRError(errorObject) }),
    {
      headers: event.req.headers,
      redirect: 'manual',
    },
    {
      nuxt: {
        '~internal': true,
        '~rendering-error': true,
        ...(errorCause !== undefined && { '~error-cause': errorCause }),
      },
    },
  ).catch(() => null)

  // Fallback to static rendered error page
  if (!res) {
    headers.set('Content-Type', 'text/html;charset=UTF-8')

    if (import.meta.dev && report) {
      const { renderErrorPage } = await import('../utils/error-channel')
      const body = await renderErrorPage(report).catch(() => undefined)
      if (body) {
        // tells the outer request the body is already a complete error page
        headers.set(ERROR_PAGE_HEADER, '1')
        return new Response(body, {
          headers,
          status: defaultRes.status,
          statusText: defaultRes.statusText,
        })
      }
    }

    const { template } = await import('../templates/error-500')
    if (import.meta.dev) {
      // TODO: Support `message` in template
      (errorObject as any).description = errorObject.message
    }

    return new Response(template(errorObject), {
      headers,
      status: defaultRes.status,
      statusText: defaultRes.statusText,
    })
  }

  let html = await res.text()

  if (import.meta.dev && !import.meta.test && report && typeof html === 'string') {
    const { publishErrorReport, withErrorOverlay } = await import('../utils/error-channel')
    try {
      await publishErrorReport(report, event as H3Event)
      if (!res.headers.has(ERROR_PAGE_HEADER)) {
        // the page behind is the app's own error page, so the report sits over
        // it a click away
        html = await withErrorOverlay(html, report, { startMinimized: true })
      }
    } catch {
      // the overlay is a development aid; never let it replace the real error
    }
  }

  const setCookies = new Set(headers.getSetCookie())
  mergeHeaders(headers, res.headers, setCookies, INTERNAL_HEADERS)
  if ('res' in event) {
    mergeHeaders(headers, (event as H3Event).res.headers, setCookies)
  }

  return new Response(html, {
    headers,
    status: res.status && res.status !== 200 ? res.status : defaultRes.status,
    statusText: res.statusText || defaultRes.statusText,
  })
}
/**
 * Rewrite stack positions from SSR-transformed positions to source positions,
 * before anything reads the error, so that every consumer agrees on them.
 */
function mapSSRStacktrace (error: unknown, seen = new Set<unknown>()): void {
  const fixStacktrace = useNitroApp().ssrSourceMaps?.fixStacktrace
  if (!fixStacktrace || !(error instanceof Error) || seen.has(error)) {
    return
  }
  seen.add(error)
  if (typeof error.stack === 'string') {
    const stack = fixStacktrace(error.stack)
    if (stack !== error.stack) {
      error.stack = stack
    }
  }
  // errors surfaced by the Vue app are wrapped, so user frames are on `cause`
  mapSSRStacktrace(error.cause, seen)
}

/** Set on a rendered error page that is already complete and should not receive an overlay. */
const ERROR_PAGE_HEADER = 'x-nuxt-error-page'
const INTERNAL_HEADERS = new Set([ERROR_PAGE_HEADER])

// Headers that should not be forwarded from the default handler or SSR render to the error page
const IGNORED_ERROR_HEADERS = new Set(['content-type', 'content-security-policy', ERROR_PAGE_HEADER])

function mergeHeaders (target: Headers, overrides: Headers | [string, string][] | HeadersIterator<[string, string]>, setCookies: Set<string>, ignore?: Set<string>): Headers {
  for (const [name, value] of overrides) {
    if (ignore?.has(name)) { continue }
    if (name === 'vary') {
      appendVary(target, value)
    } else if (name === 'set-cookie') {
      if (!setCookies.has(value)) {
        setCookies.add(value)
        target.append(name, value)
      }
    } else {
      target.set(name, value)
    }
  }
  return target
}

/**
 * Add `value`'s tokens to the `vary` header, keeping any already present. `*`
 * absorbs everything else, since it means the response varies on all headers.
 */
function appendVary (headers: Headers, value: string): void {
  const incoming = parseVary(value)
  if (!incoming.length) {
    return
  }
  const existing = parseVary(headers.get('vary'))
  if (existing.includes('*')) {
    return
  }
  if (incoming.includes('*')) {
    headers.set('vary', '*')
    return
  }
  const merged = existing.slice()
  for (const token of incoming) {
    if (!merged.includes(token)) {
      merged.push(token)
    }
  }
  headers.set('vary', merged.join(', '))
}

function parseVary (value: string | null): string[] {
  return value ? value.split(',').map(token => token.trim().toLowerCase()).filter(Boolean) : []
}

function serializeErrorCause (cause: unknown, depth = 0, seen = new WeakSet<Error>()): SerializedErrorCause | undefined {
  if (depth >= 10 || (cause instanceof Error && seen.has(cause))) { return }
  if (cause instanceof Error) {
    seen.add(cause)
    const nestedCause = serializeErrorCause(cause.cause, depth + 1, seen)
    return {
      name: cause.name,
      message: cause.message,
      ...(cause.stack && { stack: cause.stack }),
      ...(nestedCause !== undefined && { cause: nestedCause }),
    }
  }
  if (cause === null || typeof cause === 'string' || typeof cause === 'number' || typeof cause === 'boolean') {
    return cause
  }
}
