import process from 'node:process'
import type { H3Event } from 'h3'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { createHead } from '@unhead/vue/server'
import type { NuxtPayload, NuxtSSRContext } from 'nuxt/app'
import { sharedPrerenderCache } from '../cache'
// @ts-expect-error virtual file
import unheadOptions from '#internal/unhead-options.mjs'

const PRERENDER_NO_SSR_ROUTES = new Set(['/index.html', '/200.html', '/404.html'])

export function createSSRContext (event: H3Event): NuxtSSRContext {
  const url = event.url.pathname + event.url.search + event.url.hash
  const ssrContext: NuxtSSRContext = {
    url,
    event,
    runtimeConfig: useRuntimeConfig() as NuxtSSRContext['runtimeConfig'],
    noSSR: !!(process.env.NUXT_NO_SSR) || event.context.nuxt?.noSSR || (import.meta.prerender ? PRERENDER_NO_SSR_ROUTES.has(url) : false),
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
  const url = new URL(error.url)
  ssrContext.url = url.pathname + url.search + url.hash
}
