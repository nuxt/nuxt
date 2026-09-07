import { createHead } from '@unhead/vue/server'
import { createStreamableHead } from '@unhead/vue/stream/server'
import type { NuxtPayload, NuxtSSRContext } from '#app/types'
import { NUXT_NO_SSR, NUXT_PRERENDER_NO_SSR_ROUTES, NUXT_SSR_STREAMING, unheadOptions } from 'nuxt/internal/renderer-config'
import { appEvent, getRequestState } from './runtime'
import type { NuxtRendererOptions, RendererEvent } from './runtime'
import { registerStreamedHeadWarning } from './streamed-head'
import { urlHash } from './url'

const PRERENDER_NO_SSR_ROUTES = new Set<string>(NUXT_PRERENDER_NO_SSR_ROUTES)

/**
 * Streaming wants `createStreamableHead`: it marks the head so late JSON-LD,
 * `noscript` and body-positioned tags render as markup at `</body>` instead
 * of client patches.
 */
function createServerHead (path: string): NuxtSSRContext['head'] {
  if (!NUXT_SSR_STREAMING) {
    return createHead(unheadOptions) as NuxtSSRContext['head']
  }
  const { head } = createStreamableHead({ ...unheadOptions, writesBodyTags: true })
  if (import.meta.dev) {
    registerStreamedHeadWarning(head, path)
  }
  return head as NuxtSSRContext['head']
}

export function createSSRContext (options: NuxtRendererOptions, event: RendererEvent): NuxtSSRContext {
  const url = event.url.pathname + event.url.search + urlHash(event.url)
  const ssrContext: NuxtSSRContext = {
    url,
    event: appEvent(event),
    runtimeConfig: options.runtimeConfig(event),
    noSSR: !!(NUXT_NO_SSR) || getRequestState(event)?.noSSR || (import.meta.prerender ? PRERENDER_NO_SSR_ROUTES.has(url) : false),
    head: createServerHead(event.url.pathname),
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

export function returnRenderResponse (options: NuxtRendererOptions, event: RendererEvent, response: Response): Response {
  const headers = mergeHeaders(new Headers(event.res.headers), response.headers)
  return options.createResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

// TODO: rethink this before nuxt v5
export function rethrowWithResponseHeaders (event: RendererEvent, error: any): never {
  error.headers = mergeHeaders(error.headers instanceof Headers ? error.headers : new Headers(error.headers), event.res.headers)
  throw error
}
