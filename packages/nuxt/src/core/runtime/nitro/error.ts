import { joinURL, withQuery } from 'ufo'
import type { NitroErrorHandler } from 'nitro/types'
import type { H3Error, H3Event } from 'h3'
import { getRequestHeader, getRequestHeaders, send, setResponseHeader, setResponseStatus } from 'h3'
import { useNitroApp, useRuntimeConfig } from 'nitro/runtime'
import type { NuxtPayload } from 'nuxt/app'

export default <NitroErrorHandler> async function errorhandler (error: H3Error, event) {
  // Parse and normalize error
  const { stack, statusCode, statusMessage, message } = normalizeError(error)

  // Create an error object
  const errorObject = {
    url: event.path,
    statusCode,
    statusMessage,
    message,
    stack: import.meta.dev && statusCode !== 404
      ? `<pre>${stack.map(i => `<span class="stack${i.internal ? ' internal' : ''}">${i.text}</span>`).join('\n')}</pre>`
      : '',
    // TODO: check and validate error.data for serialisation into query
    data: error.data as any,
  } satisfies Partial<NuxtPayload['error']> & { url: string }

  // Console output
  if (error.unhandled || error.fatal) {
    const tags = [
      '[nuxt]',
      '[request error]',
      error.unhandled && '[unhandled]',
      error.fatal && '[fatal]',
      Number(errorObject.statusCode) !== 200 && `[${errorObject.statusCode}]`,
    ].filter(Boolean).join(' ')
    console.error(tags, (error.message || error.toString() || 'internal server error') + '\n' + stack.map(l => '  ' + l.text).join('  \n'))
  }

  if (event.handled) { return }

  // Set response code and message
  setResponseStatus(event, (errorObject.statusCode !== 200 && errorObject.statusCode) as any as number || 500, errorObject.statusMessage)

  // JSON response
  if (isJsonRequest(event)) {
    setResponseHeader(event, 'Content-Type', 'application/json')
    return send(event, JSON.stringify(errorObject))
  }

  // Access request headers
  const reqHeaders = getRequestHeaders(event)

  // Detect to avoid recursion in SSR rendering of errors
  const isRenderingError = event.path.startsWith('/__nuxt_error') || !!reqHeaders['x-nuxt-error']

  // HTML response (via SSR)
  const res = isRenderingError
    ? null
    : await useNitroApp().localFetch(
      withQuery(joinURL(useRuntimeConfig(event).app.baseURL, '/__nuxt_error'), errorObject),
      {
        headers: { ...reqHeaders, 'x-nuxt-error': 'true' },
        redirect: 'manual',
      },
    ).catch(() => null)

  // Fallback to static rendered error page
  if (!res) {
    const { template } = import.meta.dev ? await import('./error-dev') : await import('./error-500')
    if (import.meta.dev) {
      // TODO: Support `message` in template
      (errorObject as any).description = errorObject.message
    }
    if (event.handled) { return }
    setResponseHeader(event, 'Content-Type', 'text/html;charset=UTF-8')
    return send(event, template(errorObject))
  }

  const html = await res.text()
  if (event.handled) { return }

  for (const [header, value] of res.headers.entries()) {
    setResponseHeader(event, header, value)
  }
  setResponseStatus(event, res.status && res.status !== 200 ? res.status : undefined, res.statusText)

  return send(event, html)
}

/**
 * Nitro internal functions extracted from https://github.com/nitrojs/nitro/blob/main/src/runtime/internal/utils.ts
 */

function isJsonRequest (event: H3Event) {
  // If the client specifically requests HTML, then avoid classifying as JSON.
  if (hasReqHeader(event, 'accept', 'text/html')) {
    return false
  }
  return (
    hasReqHeader(event, 'accept', 'application/json') ||
    hasReqHeader(event, 'user-agent', 'curl/') ||
    hasReqHeader(event, 'user-agent', 'httpie/') ||
    hasReqHeader(event, 'sec-fetch-mode', 'cors') ||
    event.path.startsWith('/api/') ||
    event.path.endsWith('.json')
  )
}

function hasReqHeader (event: H3Event, name: string, includes: string) {
  const value = getRequestHeader(event, name)
  return (
    value && typeof value === 'string' && value.toLowerCase().includes(includes)
  )
}

function normalizeError (error: any) {
  // temp fix for https://github.com/nitrojs/nitro/issues/759
  // TODO: investigate vercel-edge not using unenv pollyfill
  const cwd = typeof process.cwd === 'function' ? process.cwd() : '/'

  // Hide details of unhandled/fatal errors in production
  const hideDetails = !import.meta.dev && error.unhandled

  const stack = hideDetails && !import.meta.prerender
    ? []
    : ((error.stack as string) || '')
        .split('\n')
        .splice(1)
        .filter(line => line.includes('at '))
        .map((line) => {
          const text = line
            .replace(cwd + '/', './')
            .replace('webpack:/', '')
            .replace('file://', '')
            .trim()
          return {
            text,
            internal:
              (line.includes('node_modules') && !line.includes('.cache')) ||
              line.includes('internal') ||
              line.includes('new Promise'),
          }
        })

  const statusCode = error.statusCode || 500
  const statusMessage = error.statusMessage ?? (statusCode === 404 ? 'Not Found' : '')
  const message = hideDetails ? 'internal server error' : (error.message || error.toString())

  return {
    stack,
    statusCode,
    statusMessage,
    message,
  }
}
