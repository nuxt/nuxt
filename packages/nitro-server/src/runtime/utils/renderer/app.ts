import type { H3Event } from 'nitro/h3'
import { FastResponse } from 'srvx'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { createHead } from '@unhead/vue/server'
import type { NuxtPayload, NuxtSSRContext } from 'nuxt/app'
import { sharedPrerenderCache } from '../cache'
// @ts-expect-error virtual file
import unheadOptions from '#internal/unhead-options.mjs'
// @ts-expect-error virtual file
import { NUXT_NO_SSR, NUXT_SHARED_DATA } from '#internal/nuxt/nitro-config.mjs'

const PRERENDER_NO_SSR_ROUTES = new Set(['/index.html', '/200.html', '/404.html'])

export function createSSRContext (event: H3Event): NuxtSSRContext {
  const url = event.url.pathname + event.url.search + event.url.hash
  const ssrContext: NuxtSSRContext = {
    url,
    event,
    runtimeConfig: useRuntimeConfig() as NuxtSSRContext['runtimeConfig'],
    noSSR: !!(NUXT_NO_SSR) || event.context.nuxt?.noSSR || (import.meta.prerender ? PRERENDER_NO_SSR_ROUTES.has(url) : false),
    head: createHead(unheadOptions),
    error: false,
    nuxt: undefined!, /* NuxtApp */
    payload: {},
    ['~payloadReducers']: Object.create(null),
    modules: new Set(),
  }

  if (import.meta.prerender) {
    if (NUXT_SHARED_DATA) {
      ssrContext['~sharedPrerenderCache'] = sharedPrerenderCache!
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

export function returnRenderResponse (event: H3Event, response: Response): Response {
  const headers = mergeHeaders(new Headers(event.res.headers), response.headers)
  return new FastResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

// TODO: rethink this before nuxt v5
export function rethrowWithResponseHeaders (event: H3Event, error: any): never {
  error.headers = mergeHeaders(error.headers instanceof Headers ? error.headers : new Headers(error.headers), event.res.headers)
  throw error
}
