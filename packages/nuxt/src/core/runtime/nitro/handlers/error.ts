import { joinURL, withQuery, withoutBase } from 'ufo'
import type { NitroErrorHandler } from 'nitro/types'
import { getRequestHeaders, send, setResponseHeader, setResponseHeaders, setResponseStatus } from 'h3'

import { useNitroApp, useRuntimeConfig } from 'nitro/runtime'
import { isJsonRequest } from '../utils/error'
import type { NuxtPayload } from '#app/nuxt'

export default <NitroErrorHandler> async function errorhandler (error, event, { defaultHandler }) {
  if (isJsonRequest(event)) {
    // let Nitro handle JSON errors
    return
  }
  // invoke default Nitro error handler (which will log appropriately if required)
  const defaultRes = await defaultHandler(error, event, { json: true })

  // let Nitro handle redirect if appropriate
  const statusCode = error.statusCode || 500
  if (statusCode === 404 && defaultRes.status === 302) {
    setResponseHeaders(event, defaultRes.headers)
    setResponseStatus(event, defaultRes.status, defaultRes.statusText)
    return send(event, JSON.stringify(defaultRes.body, null, 2))
  }

  if (import.meta.dev && typeof defaultRes.body !== 'string' && Array.isArray(defaultRes.body.stack)) {
    // normalize to string format expected by nuxt `error.vue`
    defaultRes.body.stack = defaultRes.body.stack.join('\n')
  }

  const errorObject = defaultRes.body as Pick<NonNullable<NuxtPayload['error']>, 'error' | 'statusCode' | 'statusMessage' | 'message' | 'stack'> & { url: string, data: any }
  // remove proto/hostname/port from URL
  const url = new URL(errorObject.url)
  errorObject.url = withoutBase(url.pathname, useRuntimeConfig(event).app.baseURL) + url.search + url.hash
  // add default server message
  errorObject.message ||= 'Server Error'
  // we will be rendering this error internally so we can pass along the error.data safely
  errorObject.data ||= error.data
  errorObject.statusMessage ||= error.statusMessage

  delete defaultRes.headers['content-type'] // this would be set to application/json
  delete defaultRes.headers['content-security-policy'] // this would disable JS execution in the error page

  setResponseHeaders(event, defaultRes.headers)

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

  if (event.handled) { return }

  // Fallback to static rendered error page
  if (!res) {
    const { template } = import.meta.dev ? await import('../templates/error-dev') : await import('../templates/error-500')
    if (import.meta.dev) {
      // TODO: Support `message` in template
      (errorObject as any).description = errorObject.message
    }
    setResponseHeader(event, 'Content-Type', 'text/html;charset=UTF-8')
    return send(event, template(errorObject))
  }

  const html = await res.text()
  for (const [header, value] of res.headers.entries()) {
    setResponseHeader(event, header, value)
  }
  setResponseStatus(event, res.status && res.status !== 200 ? res.status : defaultRes.status, res.statusText || defaultRes.statusText)

  return send(event, html)
}
