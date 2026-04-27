import type { H3Event } from 'h3'
import { decodePath, encodePath } from 'ufo'
import { useRuntimeConfig } from 'nitropack/runtime'
import { createHead } from '@unhead/vue/server'
import type { NuxtPayload, NuxtSSRContext } from 'nuxt/app'
import { sharedPrerenderCache } from '../cache'
// @ts-expect-error virtual file
import unheadOptions from '#internal/unhead-options.mjs'
// @ts-expect-error virtual file
import { NUXT_NO_SSR, NUXT_SHARED_DATA } from '#internal/nuxt/nitro-config.mjs'

const PRERENDER_NO_SSR_ROUTES = new Set(['/index.html', '/200.html', '/404.html'])

// path is decoded in h3, but vue-router expects an encoded path; decode-then-encode is idempotent
function encodeEventPath (path: string): string {
  const queryIndex = path.indexOf('?')
  if (queryIndex === -1) { return encodePath(decodePath(path)) }
  return encodePath(decodePath(path.slice(0, queryIndex))) + path.slice(queryIndex)
}

export function createSSRContext (event: H3Event): NuxtSSRContext {
  const url = encodeEventPath(event.path)
  const ssrContext: NuxtSSRContext = {
    url,
    event,
    runtimeConfig: useRuntimeConfig(event) as NuxtSSRContext['runtimeConfig'],
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
  ssrContext.url = error.url
}
