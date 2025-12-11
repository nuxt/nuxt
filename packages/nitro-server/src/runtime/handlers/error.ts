import { joinURL, withQuery } from 'ufo'
import type { NitroErrorHandler } from 'nitro/types'
import type { NuxtPayload } from 'nuxt/app'

import { useRuntimeConfig } from 'nitro/runtime-config'
import { isJsonRequest } from '../utils/error'
import type { H3Event } from 'nitro/h3'
import { generateErrorOverlayHTML } from '../utils/dev'

export default <NitroErrorHandler> async function errorhandler (error, event, { defaultHandler }) {
  // invoke default Nitro error handler (which will log appropriately if required)
  const defaultRes = await defaultHandler(error, event, { json: true })

  // return Nitro response + our headers for redirects and JSON responses
  const status = error.status || 500
  const headers = new Headers(error.headers)
  if (isJsonRequest(event) || (status === 404 && defaultRes.status === 302)) {
    const headerEntries = [
      Object.entries(defaultRes.headers),
      ...'res' in event ? [(event.res as Response).headers.entries()] : [],
    ]
    for (const entries of headerEntries) {
      mergeHeaders(headers, entries, new Set())
    }

    return new Response(typeof defaultRes.body === 'string' ? defaultRes.body : JSON.stringify(defaultRes.body, null, 2), {
      headers,
      status: defaultRes.status,
      statusText: defaultRes.statusText,
    })
  }

  const errorObject = defaultRes.body as Pick<NonNullable<NuxtPayload['error']>, 'status' | 'statusText' | 'message' | 'stack'> & { url: URL | string, data: any }
  // we will be rendering this error internally so we pass along the error.data safely
  errorObject.data ||= error.data
  errorObject.url = errorObject.url.toString()

  for (const header in defaultRes.headers) {
    if (
      // this would be set to application/json
      header === 'content-type' ||
      // this would disable JS execution in the error page
      header === 'content-security-policy' ||
      headers.has(header)
    ) {
      continue
    }
    headers.set(header, defaultRes.headers[header]!)
  }

  // Detect to avoid recursion in SSR rendering of errors
  const isRenderingError = (event as H3Event).url?.pathname.startsWith('/__nuxt_error') || !!event.req.headers.get('x-nuxt-error')

  if (!isRenderingError) {
    event.req.headers.set('x-nuxt-error', 'true')
  }

  // HTML response (via SSR)
  const res = !isRenderingError && await fetch(
    withQuery(joinURL(useRuntimeConfig().app.baseURL, '/__nuxt_error'), errorObject),
    {
      headers: event.req.headers,
      redirect: 'manual',
    },
  ).catch(() => null)

  // Fallback to static rendered error page
  if (!res) {
    const { template } = await import('../templates/error-500')
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

  const responseHtml = import.meta.dev && !import.meta.test && typeof html === 'string'
    ? html.replace('</body>', `${generateErrorOverlayHTML((await defaultHandler(error, event, { json: false })).body as string, { startMinimized: 300 <= error.status && error.status < 500 })}</body>`)
    : html

  const setCookies = new Set(headers.getSetCookie())
  mergeHeaders(headers, res.headers, setCookies)
  if ('res' in event) {
    mergeHeaders(headers, (event as H3Event).res.headers, setCookies)
  }

  return new Response(responseHtml, {
    headers,
    status: res.status && res.status !== 200 ? res.status : defaultRes.status,
    statusText: res.statusText || defaultRes.statusText,
  })
}
function mergeHeaders (target: Headers, overrides: Headers | [string, string][] | HeadersIterator<[string, string]>, setCookies: Set<string>): Headers {
  for (const [name, value] of overrides) {
    if (name === 'set-cookie') {
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
