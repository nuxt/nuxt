import { createHead } from '@unhead/vue/server'
import type { RequestEvent } from '@nuxt/schema'
import type { NuxtPayload, NuxtSSRContext } from '#app/types'
import { NUXT_NO_SSR, NUXT_PRERENDER_NO_SSR_ROUTES, unheadOptions } from 'nuxt/internal/renderer-config'
import { getRequestState } from './runtime'
import type { NuxtRendererOptions } from './runtime'
import { urlHash } from './url'

const PRERENDER_NO_SSR_ROUTES = new Set<string>(NUXT_PRERENDER_NO_SSR_ROUTES)

export function createSSRContext (options: NuxtRendererOptions, event: RequestEvent): NuxtSSRContext {
  const url = event.url.pathname + event.url.search + urlHash(event.url)
  const ssrContext: NuxtSSRContext = {
    url,
    event,
    runtimeConfig: options.runtimeConfig(),
    noSSR: !!(NUXT_NO_SSR) || getRequestState(event)?.noSSR || (import.meta.prerender ? PRERENDER_NO_SSR_ROUTES.has(url) : false),
    head: createHead(unheadOptions),
    error: false,
    nuxt: undefined!, /* NuxtApp */
    payload: {},
    ['~payloadReducers']: Object.create(null),
    modules: new Set(),
  }

  if (import.meta.prerender) {
    const sharedDataCache = options.prerender?.sharedDataCache
    if (sharedDataCache) {
      ssrContext['~sharedPrerenderCache'] = sharedDataCache
    }
    ssrContext.payload.prerenderedAt = Date.now()
  }

  return ssrContext
}

export function setSSRError (ssrContext: NuxtSSRContext, error: NuxtPayload['error'] & { url: string }): void {
  ssrContext.error = true
  ssrContext.payload = { error }
  const url = new URL(error.url)
  ssrContext.url = url.pathname + url.search + url.hash
}

// Layer `overlay` onto `base`, overwriting per header except `set-cookie`,
// which is appended so cookies from both sides survive.
export function mergeHeaders (base: Headers, overlay: Headers): Headers {
  for (const [name, value] of overlay) {
    if (name === 'set-cookie') { continue }
    base.set(name, value)
  }
  for (const cookie of overlay.getSetCookie()) {
    base.append('set-cookie', cookie)
  }
  return base
}

export function returnRenderResponse (options: NuxtRendererOptions, event: RequestEvent, response: Response): Response {
  const headers = mergeHeaders(new Headers(event.res.headers), response.headers)
  return options.createResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

// TODO: rethink this before nuxt v5
export function rethrowWithResponseHeaders (event: RequestEvent, error: any): never {
  error.headers = mergeHeaders(error.headers instanceof Headers ? error.headers : new Headers(error.headers), event.res.headers)
  throw error
}
