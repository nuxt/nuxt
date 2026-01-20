import { joinURL, withQuery, withoutBase } from 'ufo'
import type { NitroErrorHandler } from 'nitropack/types'
import { appendResponseHeader, getRequestHeaders, send, setResponseHeader, setResponseHeaders, setResponseStatus } from 'h3'
import type { NuxtPayload } from 'nuxt/app'

import { useNitroApp, useRuntimeConfig } from 'nitropack/runtime'
import { isJsonRequest } from '../utils/error'
import { generateErrorOverlayHTML } from '../utils/dev'

let runner: { ssrFixStacktrace(error: Error): Promise<Error> } | undefined

export default <NitroErrorHandler> async function errorhandler (error, event, { defaultHandler }) {
  if (event.handled || isJsonRequest(event)) {
    // let Nitro handle JSON errors
    return
  }

  if (import.meta.dev) {
    // @ts-expect-error file produced after build
    runner ||= await import('#build/dist/server/vite-node-runner.mjs').then(r => r.default || r)
    await runner!.ssrFixStacktrace(error)
  }

  // invoke default Nitro error handler (which will log appropriately if required)
  const defaultRes = await defaultHandler(error, event, { json: true })

  // let Nitro handle redirect if appropriate
  const status = (error as any).status || error.statusCode || 500
  if (status === 404 && defaultRes.status === 302) {
    setResponseHeaders(event, defaultRes.headers)
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
  // add default server message
  errorObject.message ||= 'Server Error'
  // we will be rendering this error internally so we can pass along the error.data safely
  errorObject.data ||= error.data
  errorObject.statusText ||= (error as any).statusText || error.statusMessage

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
    const { template } = await import('../templates/error-500')
    if (import.meta.dev) {
      // TODO: Support `message` in template
      (errorObject as any).description = errorObject.message
    }
    setResponseHeader(event, 'Content-Type', 'text/html;charset=UTF-8')
    return send(event, template(errorObject))
  }

  const html = await res.text()
  for (const [header, value] of res.headers.entries()) {
    if (header === 'set-cookie') {
      appendResponseHeader(event, header, value)
      continue
    }
    setResponseHeader(event, header, value)
  }
  setResponseStatus(event, res.status && res.status !== 200 ? res.status : defaultRes.status, res.statusText || defaultRes.statusText)

  if (import.meta.dev && !import.meta.test && typeof html === 'string') {
    const prettyResponse = await defaultHandler(error, event, { json: false })
    if (typeof prettyResponse.body === 'string') {
      return send(event, html.replace('</body>', `${generateErrorOverlayHTML(prettyResponse.body, { startMinimized: 300 <= status && status < 500 })}</body>`))
    }
  }

  return send(event, html)
}
