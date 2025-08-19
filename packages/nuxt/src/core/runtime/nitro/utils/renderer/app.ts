import type { H3Event } from 'h3'
import { useRuntimeConfig } from 'nitro/runtime'
import { createHead } from '@unhead/vue/server'
import { sharedPrerenderCache } from '../cache'
import type { NuxtSSRContext } from '#app'
import type { NuxtPayload } from '#app/nuxt'
// @ts-expect-error virtual file
import unheadOptions from '#internal/unhead-options.mjs'

const PRERENDER_NO_SSR_ROUTES = new Set(['/index.html', '/200.html', '/404.html'])

export function createSSRContext (event: H3Event): NuxtSSRContext {
  const ssrContext: NuxtSSRContext = {
    url: event.url.pathname,
    event,
    runtimeConfig: useRuntimeConfig(event) as NuxtSSRContext['runtimeConfig'],
    noSSR: !!(process.env.NUXT_NO_SSR) || event.context.nuxt?.noSSR || (import.meta.prerender ? PRERENDER_NO_SSR_ROUTES.has(event.url.pathname) : false),
    head: createHead(unheadOptions),
    error: false,
    nuxt: undefined!, /* NuxtApp */
    payload: {},
    _payloadReducers: Object.create(null),
    modules: new Set(),
  }

  if (import.meta.prerender) {
    if (process.env.NUXT_SHARED_DATA) {
      ssrContext._sharedPrerenderCache = sharedPrerenderCache!
    }
    ssrContext.payload.prerenderedAt = Date.now()
  }

  return ssrContext
}

export function setSSRError (ssrContext: NuxtSSRContext, error: NuxtPayload['error'] & { url: string }) {
  ssrContext.error = true
  ssrContext.payload = { error }
  ssrContext.url = error.url
}
