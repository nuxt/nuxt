import { joinURL, withQuery } from 'ufo'
import type { NitroErrorHandler } from 'nitropack'
import type { H3Error } from 'h3'
import { getRequestHeaders, getRequestURL, getResponseHeader, send, sendRedirect, setResponseHeader, setResponseStatus } from 'h3'
import type { NuxtPayload } from 'nuxt/app'

import { isJsonRequest, setSecurityHeaders } from '../utils/error'
import { useRuntimeConfig } from '#internal/nitro'
import { useNitroApp } from '#internal/nitro/app'

export default <NitroErrorHandler> async function errorhandler (error: H3Error, event) {
  if (isJsonRequest(event)) {
    // let Nitro handle JSON errors
    return
  }

  const isSensitive = error.unhandled || error.fatal
  const statusCode = error.statusCode || 500
  const statusMessage = error.statusMessage || 'Server Error'
  const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })

  if (statusCode === 404) {
    const baseURL = import.meta.baseURL || '/'
    if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) {
      return sendRedirect(event, `${baseURL}${url.pathname.slice(1)}${url.search}`)
    }
  }

  // Console output
  if (isSensitive) {
    if (import.meta.dev) {
      const { logError } = await import('../utils/error-dev')
      await logError(event, url, error)
    } else {
      const tags = [error.unhandled && '[unhandled]', error.fatal && '[fatal]'].filter(Boolean).join(' ')
      console.error(`[nuxt] [request error] ${tags} [${event.method}] ${url}\n`, error)
    }
  }

  if (event.handled) { return }

  // Parse and normalize error
  // Create an error object
  const errorObject: Pick<NonNullable<NuxtPayload['error']>, 'error' | 'statusCode' | 'statusMessage' | 'message' | 'stack'> & { url: string, data: any } = {
    error: true,
    url: url.toString(),
    statusCode,
    statusMessage,
    message: isSensitive && !import.meta.dev ? 'Server Error' : error.message,
    data: isSensitive && !import.meta.dev ? undefined : error.data as any,
  }

  if (import.meta.dev) {
    errorObject.stack = error.stack?.split('\n').map(line => line.trim()).join('\n')
  }

  // Send response
  setSecurityHeaders(event)
  setResponseStatus(event, statusCode, statusMessage)
  if (statusCode === 404 || !getResponseHeader(event, 'cache-control')) {
    setResponseHeader(event, 'cache-control', 'no-cache')
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
    const { template } = import.meta.dev ? await import('../templates/error-dev') : await import('../templates/error-500')
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
