import { createHead } from '@unhead/vue/server'
import type { NuxtPayload, NuxtSSRContext } from '#app/types'
import { NUXT_NO_SSR, NUXT_PRERENDER_NO_SSR_ROUTES, unheadOptions } from 'nuxt/renderer-config'
import { appEvent, getRequestState, serverRuntime } from './runtime'
import type { RenderedResponse, RendererEvent } from './runtime'
import { urlHash } from './url'

const PRERENDER_NO_SSR_ROUTES = new Set<string>(NUXT_PRERENDER_NO_SSR_ROUTES)

export function createSSRContext (event: RendererEvent): NuxtSSRContext {
  const url = event.url.pathname + event.url.search + urlHash(event.url)
  const ssrContext: NuxtSSRContext = {
    url,
    event: appEvent(event),
    runtimeConfig: serverRuntime.runtimeConfig(event),
    noSSR: !!(NUXT_NO_SSR) || getRequestState(event)?.noSSR || (import.meta.prerender ? PRERENDER_NO_SSR_ROUTES.has(url) : false),
    head: createHead(unheadOptions),
    error: false,
    nuxt: undefined!, /* NuxtApp */
    payload: {},
    ['~payloadReducers']: Object.create(null),
    modules: new Set(),
  }

  if (import.meta.prerender) {
    const sharedDataCache = serverRuntime.prerender?.sharedDataCache
    if (sharedDataCache) {
      ssrContext['~sharedPrerenderCache'] = sharedDataCache
    }
    ssrContext.payload.prerenderedAt = Date.now()
  }

  return ssrContext
}

/**
 * Turn the response the renderer assembled into a web-standard `Response`, carrying the
 * headers queued on the event alongside the ones the response names for itself.
 */
export function returnRenderResponse (event: RendererEvent, response: RenderedResponse): Response {
  const headers = new Headers(event.res.headers)
  for (const name in response.headers) {
    headers.set(name, response.headers[name]!)
  }
  return serverRuntime.createResponse(response.body as BodyInit | null ?? null, {
    status: response.statusCode ?? event.res.status,
    statusText: response.statusMessage ?? event.res.statusText,
    headers,
  })
}

export function setSSRError (ssrContext: NuxtSSRContext, error: NuxtPayload['error'] & { url: string }): void {
  ssrContext.error = true
  ssrContext.payload = { error }
  ssrContext.url = error.url
}
