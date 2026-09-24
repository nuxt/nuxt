import { joinURL, withQuery, withoutBase } from 'ufo'
import type { NitroErrorHandler } from 'nitropack/types'
import { appendResponseHeader, getResponseHeader, isError, send, setResponseHeader, setResponseHeaders, setResponseStatus } from 'h3'
import type { H3Event } from 'h3'
import type { ErrorReport } from 'my-bad'
import type { NuxtRequestContext } from 'nuxt/schema'
import type { NuxtPayload, SerializedErrorCause } from '#app/types'

import { useNitroApp, useRuntimeConfig } from 'nitropack/runtime'
import { isJsonRequest } from '../utils/error'
import { getFetchedRequestContext } from '../utils/event'
import { applyPrerenderHints } from '../utils/prerender'

export default <NitroErrorHandler> async function errorhandler (error, event, { defaultHandler }) {
  if (event.handled) {
    return
  }

  // Skip SSR error rendering if we're already inside one, to avoid recursion.
  const isRenderingError = !!(event.context.nuxt?.['~rendering-error'] || getFetchedRequestContext(event)?.['~rendering-error'])

  let report: ErrorReport | undefined
  let errorCause: SerializedErrorCause | undefined
  if (import.meta.dev) {
    const errorChannel = await import('#internal/nuxt/error-channel')
    // a handled client error (a 404, a failed validation) is the app working as intended,
    // unless the app threw a bare value that was given a status on its way here
    // branded rather than `instanceof`, so an error raised against another copy of h3
    // still reads as an HTTP error
    const isHTTPError = isError(error)
    const isExpected = !(error as { unhandled?: boolean }).unhandled && isHTTPError && (error.statusCode || 500) < 500 && !(THROWN_VALUE in error)
    report = isExpected ? undefined : await errorChannel.createErrorReport(error, event).catch(() => undefined)
    errorCause = errorChannel.serializeErrorCause(error.cause)
    if (report && !isRenderingError && !import.meta.test) {
      await errorChannel.publishErrorReport(report, event).catch(() => {})
    }
    // a dev server that owns the channel prints the reports it is sent
    if (report && !isRenderingError && !errorChannel.shouldForwardReports() && ((error as { unhandled?: boolean }).unhandled ?? !isHTTPError)) {
      const rendered = await errorChannel.renderErrorAnsi(report).catch(() => undefined)
      if (rendered) {
        console.log(`[request error] [${event.method}] ${event.path}\n\n${rendered}`)
      } else {
        console.error(`[request error] [${event.method}] ${event.path}\n\n`, error)
      }
    }
  }

  // a cached module evaluation rethrows the same error, so it must still parse as a stack
  const stacks = import.meta.dev ? snapshotStacks(error) : undefined

  if (isJsonRequest(event)) {
    // let Nitro render and log JSON errors, unless the report has already been printed
    if (!report) {
      return
    }
    const { headers, status, statusText, body } = await defaultHandler(error, event, { json: true, silent: true })
    stacks?.restore()
    setResponseHeaders(event, headers)
    appendVary(event, 'accept, sec-fetch-mode')
    setResponseStatus(event, status, statusText)
    return send(event, typeof body === 'string' ? body : JSON.stringify(body, null, 2))
  }

  // invoke default Nitro error handler (which will log appropriately if required)
  const defaultRes = await defaultHandler(error, event, { json: true, silent: import.meta.dev && !!report })
  stacks?.restore()

  // the render that failed may have collected hints before it threw
  if (import.meta.prerender) {
    applyPrerenderHints(event)
  }

  // let Nitro handle redirect if appropriate
  const status = (error as any).status || error.statusCode || 500
  if (status === 404 && defaultRes.status === 302) {
    setResponseHeaders(event, defaultRes.headers)
    appendVary(event, 'accept, sec-fetch-mode')
    setResponseStatus(event, defaultRes.status, defaultRes.statusText)
    return send(event, JSON.stringify(defaultRes.body, null, 2))
  }

  if (import.meta.dev && typeof defaultRes.body !== 'string' && Array.isArray(defaultRes.body.stack)) {
    // normalize to string format expected by nuxt `error.vue`
    defaultRes.body.stack = defaultRes.body.stack.join('\n')
  }

  const errorObject = defaultRes.body as Pick<NonNullable<NuxtPayload['error']>, 'error' | 'status' | 'statusText' | 'message' | 'stack'> & { url: string, data: any }
  // remove proto/hostname/port from URL
  const url = new URL(errorObject.url)
  errorObject.url = withoutBase(url.pathname, useRuntimeConfig(event).app.baseURL) + url.search + url.hash
  // add default server message (keep sanitized for unhandled errors)
  errorObject.message = (error as any).unhandled
    ? (errorObject.message || 'Server Error')
    : (error.message || errorObject.message || 'Server Error')
  // we will be rendering this error internally so we can pass along the error.data safely
  if (!(error as any).unhandled) {
    errorObject.data ||= error.data
  }
  errorObject.statusText ||= (error as any).statusText || error.statusMessage

  delete defaultRes.headers['content-type'] // this would be set to application/json
  delete defaultRes.headers['content-security-policy'] // this would disable JS execution in the error page

  setResponseHeaders(event, defaultRes.headers)
  appendVary(event, 'accept, sec-fetch-mode')

  if (!isRenderingError) {
    event.context.nuxt = { ...event.context.nuxt, '~rendering-error': true }
  }

  // HTML response (via SSR)
  const res = isRenderingError
    ? null
    : await useNitroApp().localFetch(
        withQuery(joinURL(useRuntimeConfig(event).app.baseURL, '/__nuxt_error'), {
          ...errorObject,
          ...(errorCause !== undefined && { cause: JSON.stringify(errorCause) }),
        }),
        {
          headers: event.headers,
          redirect: 'manual',
          context: {
            nuxt: { '~rendering-error': true } satisfies NuxtRequestContext,
          },
        },
      ).catch(() => null)

  if (event.handled) { return }

  // Fallback to static rendered error page
  if (!res) {
    setResponseHeader(event, 'Content-Type', 'text/html;charset=UTF-8')

    if (import.meta.dev && isRenderingError) {
      setResponseHeader(event, ERROR_PAGE_HEADER, '1')
    } else if (import.meta.dev && report) {
      const { renderErrorPage } = await import('#internal/nuxt/error-channel')
      const body = await renderErrorPage(report, event).catch(() => undefined)
      if (body) {
        return send(event, body)
      }
    }

    const { template } = await import('../templates/error-500')
    if (import.meta.dev) {
      // TODO: Support `message` in template
      (errorObject as any).description = errorObject.message
    }
    return send(event, template(errorObject))
  }

  let html = await res.text()
  for (const [header, value] of res.headers.entries()) {
    if (header === ERROR_PAGE_HEADER) { continue }
    // the error render's own prerender hints add to the ones already on this response
    if (header === 'set-cookie' || header === 'x-nitro-prerender') {
      appendResponseHeader(event, header, value)
      continue
    }
    setResponseHeader(event, header, value)
  }
  setResponseStatus(event, res.status && res.status !== 200 ? res.status : defaultRes.status, res.statusText || defaultRes.statusText)

  if (import.meta.dev && !import.meta.test && report && typeof html === 'string') {
    const { renderErrorPage, withErrorOverlay } = await import('#internal/nuxt/error-channel')
    try {
      html = res.headers.has(ERROR_PAGE_HEADER)
        // the app's own error page did not render, so the report is the page
        ? await renderErrorPage(report, event)
        : await withErrorOverlay(html, report, { startMinimized: true, event })
    } catch {
      // the overlay is a development aid; never let it replace the real error
    }
  }

  return send(event, html)
}

/** The stacks of an error and its causes as raised, before Nitro rewrites them. */
function snapshotStacks (error: unknown): { restore: () => void } {
  const stacks: [Error, string | undefined][] = []
  const seen = new Set<unknown>()
  for (let current = error; current instanceof Error && !seen.has(current); current = current.cause) {
    seen.add(current)
    stacks.push([current, current.stack])
  }
  return {
    restore () {
      for (const [target, stack] of stacks) {
        if (target.stack !== stack) {
          try {
            Object.defineProperty(target, 'stack', { value: stack, writable: true, configurable: true })
          } catch {
            // a frozen error keeps the rewritten stack
          }
        }
      }
    },
  }
}

/** Set on an error created from a thrown value that was not an `Error`. */
const THROWN_VALUE = Symbol.for('nuxt:dev:thrown')

/** Set when the app's own error page could not render. */
const ERROR_PAGE_HEADER = 'x-nuxt-error-page'

/**
 * Add `value`'s tokens to the response `vary` header, keeping any already
 * present. `*` absorbs everything else, since it means the response varies on
 * all headers.
 */
function appendVary (event: H3Event, value: string): void {
  const incoming = parseVary(value)
  if (!incoming.length) {
    return
  }
  const existing = parseVary(getResponseHeader(event, 'vary'))
  if (existing.includes('*')) {
    return
  }
  if (incoming.includes('*')) {
    setResponseHeader(event, 'vary', '*')
    return
  }
  const merged = existing.slice()
  for (const token of incoming) {
    if (!merged.includes(token)) {
      merged.push(token)
    }
  }
  setResponseHeader(event, 'vary', merged.join(', '))
}

function parseVary (value: number | string | string[] | undefined): string[] {
  const tokens = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return tokens.map(token => token.trim().toLowerCase()).filter(Boolean)
}
