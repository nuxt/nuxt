import type { H3Event } from 'h3'
import { decodePath } from 'ufo'
import { useRuntimeConfig } from 'nitropack/runtime'
import { createHead } from '@unhead/vue/server'
import type { NuxtPayload, NuxtSSRContext } from 'nuxt/app'
import { sharedPrerenderCache } from '../cache'
// @ts-expect-error virtual file
import unheadOptions from '#internal/unhead-options.mjs'
// @ts-expect-error virtual file
import { NUXT_NO_SSR, NUXT_SHARED_DATA } from '#internal/nuxt/nitro-config.mjs'

const PRERENDER_NO_SSR_ROUTES = new Set(['/index.html', '/200.html', '/404.html'])

export function createSSRContext (event: H3Event): NuxtSSRContext {
  const ssrContext: NuxtSSRContext = {
    url: decodePath(event.path),
    event,
    runtimeConfig: useRuntimeConfig(event) as NuxtSSRContext['runtimeConfig'],
    noSSR: !!(NUXT_NO_SSR) || event.context.nuxt?.noSSR || (import.meta.prerender ? PRERENDER_NO_SSR_ROUTES.has(event.path) : false),
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
  ssrContext.url = error.url
}
