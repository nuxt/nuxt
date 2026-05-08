import type { H3Event } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { createHead } from '@unhead/vue/server'
// @ts-expect-error withAsyncContext is exported at runtime but not in Vue's public types
import { getCurrentInstance, withAsyncContext } from 'vue'
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

// Vue's `withAsyncContext` synchronously captures+unsets `currentInstance` (restore fn discarded).
// Guard avoids a Vue warning when `currentInstance` is already null (no leak to clear).
export function clearVueCurrentInstance (): void {
  if (getCurrentInstance()) {
    withAsyncContext(() => null)
  }
}
