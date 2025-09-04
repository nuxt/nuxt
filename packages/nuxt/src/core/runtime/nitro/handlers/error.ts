import { joinURL, withQuery, withoutBase } from 'ufo'
import type { NitroErrorHandler } from 'nitro/types'

import { useNitroApp, useRuntimeConfig } from 'nitro/runtime'
import { isJsonRequest } from '../utils/error'
import type { NuxtPayload } from '#app/nuxt'

export default <NitroErrorHandler> async function errorhandler (error, event, { defaultHandler }) {
  // TODO: support handled checks
  // if (event.handled) { return }

  if (isJsonRequest(event)) {
    // let Nitro handle JSON errors
    return
  }
  // invoke default Nitro error handler (which will log appropriately if required)
  const defaultRes = await defaultHandler(error, event, { json: true })

  // let Nitro handle redirect if appropriate
  const statusCode = error.status || 500
  // TODO: investigate existing headers
  const headers = new Headers(error.headers)
  if (statusCode === 404 && defaultRes.status === 302) {
    for (const [header, value] of Object.entries(defaultRes.headers)) {
      headers.set(header, value)
    }

    return new Response(typeof defaultRes.body === 'string' ? defaultRes.body : JSON.stringify(defaultRes.body, null, 2), {
      headers,
      status: defaultRes.status,
      statusText: defaultRes.statusText,
    })
  }

  if (import.meta.dev && typeof defaultRes.body !== 'string' && Array.isArray(defaultRes.body.stack)) {
    // normalize to string format expected by nuxt `error.vue`
    defaultRes.body.stack = defaultRes.body.stack.join('\n')
  }

  // TODO: use Nitro format error object
  const errorObject = defaultRes.body as Pick<NonNullable<NuxtPayload['error']>, 'error' | 'statusCode' | 'statusText' | 'message' | 'stack'> & { url: string, data: any }
  // remove proto/hostname/port from URL
  const url = new URL(errorObject.url)
  errorObject.url = withoutBase(url.pathname, useRuntimeConfig(event).app.baseURL) + url.search + url.hash
  // add default server message
  errorObject.message ||= 'Server Error'
  // we will be rendering this error internally so we can pass along the error.data safely
  errorObject.data ||= error.data
  errorObject.statusText ||= error.statusText

  for (const header in defaultRes.headers) {
    if (
      // this would be set to application/json
      header === 'content-type' ||
      // this would disable JS execution in the error page
      header === 'content-security-policy') {
      continue
    }
    headers.set(header, defaultRes.headers[header]!)
  }

  // Detect to avoid recursion in SSR rendering of errors
  const isRenderingError = event.url.pathname.startsWith('/__nuxt_error') || !!event.req.headers.get('x-nuxt-error')

  if (!isRenderingError) {
    event.req.headers.set('x-nuxt-error', 'true')
  }

  // HTML response (via SSR)
  const res = isRenderingError
    ? null
    : await useNitroApp().fetch(
        withQuery(joinURL(useRuntimeConfig(event).app.baseURL, '/__nuxt_error'), errorObject),
        {
          headers: event.req.headers,
          redirect: 'manual',
        },
      ).catch(() => null)

  // TODO: support handled checks
  // if (event.handled) { return }

  // Fallback to static rendered error page
  if (!res) {
    const { template } = import.meta.dev ? await import('../templates/error-dev') : await import('../templates/error-500')
    if (import.meta.dev) {
      // TODO: Support `message` in template
      (errorObject as any).description = errorObject.message
    }
    headers.set('Content-Type', 'text/html;charset=UTF-8')

    return new Response(template(errorObject), {
      headers,
      status: defaultRes.status,
      statusText: defaultRes.statusText,
    })
  }

  const html = await res.text()
  for (const [header, value] of res.headers.entries()) {
    if (header === 'set-cookie') {
      headers.append(header, value)
      continue
    }
    headers.set(header, value)
  }

  headers.set('Content-Type', 'text/html;charset=UTF-8')

  return new Response(html, {
    headers,
    status: res.status && res.status !== 200 ? res.status : defaultRes.status,
    statusText: res.statusText || defaultRes.statusText,
  })
}
