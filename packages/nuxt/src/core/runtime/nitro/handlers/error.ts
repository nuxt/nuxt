import { joinURL, withQuery } from 'ufo'
import type { NitroErrorHandler } from 'nitropack'
import { getRequestHeaders, send, setResponseHeader, setResponseHeaders, setResponseStatus } from 'h3'

import { isJsonRequest } from '../utils/error'
import { useRuntimeConfig } from '#internal/nitro'
import { useNitroApp } from '#internal/nitro/app'
import type { NuxtPayload } from '#app/nuxt'

export default <NitroErrorHandler> async function errorhandler (error, event, { defaultHandler }) {
  if (isJsonRequest(event)) {
    // let Nitro handle JSON errors
    return
  }
  // invoke default Nitro error handler (which will log appropriately if required)
  const defaultError = await defaultHandler(error, event, { json: true })

  if (event.handled) { return }

  // let Nitro handle redirect if appropriate
  const statusCode = error.statusCode || 500
  if (statusCode === 404 && defaultError.status === 302) {
    return defaultError
  }

  if (import.meta.dev && typeof defaultError.body !== 'string' && Array.isArray(defaultError.body.stack)) {
    // normalize to string format expected by nuxt `error.vue`
    defaultError.body.stack = defaultError.body.stack.join('\n')
  }

  const errorObject = defaultError.body as Pick<NonNullable<NuxtPayload['error']>, 'error' | 'statusCode' | 'statusMessage' | 'message' | 'stack'> & { url: string, data: any }
  errorObject.message ||= 'Server Error'

  setResponseHeaders(event, {
    'x-content-type-options': defaultError.headers['x-content-type-options'],
    // Prevent error page from being embedded in an iframe
    'x-frame-options': defaultError.headers['x-frame-options'],
    // Prevent browsers from sending the Referer header
    'referrer-policy': defaultError.headers['referrer-policy'],
  })

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
  setResponseStatus(event, res.status && res.status !== 200 ? res.status : defaultError.status, res.statusText || defaultError.statusText)

  return send(event, html)
}
