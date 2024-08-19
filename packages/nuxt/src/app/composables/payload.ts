import { hasProtocol, joinURL, withoutTrailingSlash } from 'ufo'
import { parse } from 'devalue'
import { useHead } from '@unhead/vue'
import { getCurrentInstance, onServerPrefetch, reactive } from 'vue'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
import type { NuxtPayload } from '../nuxt'

import { useRoute } from './router'
import { getAppManifest, getRouteRules } from './manifest'

// @ts-expect-error virtual import
import { appId, appManifest, multiApp, payloadExtraction, renderJsonPayloads } from '#build/nuxt.config.mjs'

interface LoadPayloadOptions {
  fresh?: boolean
  hash?: string
}

/** @since 3.0.0 */
export async function loadPayload (url: string, opts: LoadPayloadOptions = {}): Promise<Record<string, any> | null> {
  if (import.meta.server || !payloadExtraction) { return null }
  const payloadURL = await _getPayloadURL(url, opts)
  const nuxtApp = useNuxtApp()
  const cache = nuxtApp._payloadCache = nuxtApp._payloadCache || {}
  if (payloadURL in cache) {
    return cache[payloadURL]
  }
  cache[payloadURL] = isPrerendered(url).then((prerendered) => {
    if (!prerendered) {
      cache[payloadURL] = null
      return null
    }
    return _importPayload(payloadURL).then((payload) => {
      if (payload) { return payload }

      delete cache[payloadURL]
      return null
    })
  })
  return cache[payloadURL]
}
/** @since 3.0.0 */
export function preloadPayload (url: string, opts: LoadPayloadOptions = {}): Promise<void> {
  const nuxtApp = useNuxtApp()
  const promise = _getPayloadURL(url, opts).then((payloadURL) => {
    nuxtApp.runWithContext(() => useHead({
      link: [
        { rel: 'modulepreload', href: payloadURL },
      ],
    }))
  })
  if (import.meta.server) {
    onServerPrefetch(() => promise)
  }
  return promise
}

// --- Internal ---

const filename = renderJsonPayloads ? '_payload.json' : '_payload.js'
async function _getPayloadURL (url: string, opts: LoadPayloadOptions = {}) {
  const u = new URL(url, 'http://localhost')
  if (u.host !== 'localhost' || hasProtocol(u.pathname, { acceptRelative: true })) {
    throw new Error('Payload URL must not include hostname: ' + url)
  }
  const config = useRuntimeConfig()
  const hash = opts.hash || (opts.fresh ? Date.now() : config.app.buildId)
  const cdnURL = config.app.cdnURL
  const baseOrCdnURL = cdnURL && await isPrerendered(url) ? cdnURL : config.app.baseURL
  return joinURL(baseOrCdnURL, u.pathname, filename + (hash ? `?${hash}` : ''))
}

async function _importPayload (payloadURL: string) {
  if (import.meta.server || !payloadExtraction) { return null }
  const payloadPromise = renderJsonPayloads
    ? fetch(payloadURL).then(res => res.text().then(parsePayload))
    : import(/* webpackIgnore: true */ /* @vite-ignore */ payloadURL).then(r => r.default || r)

  try {
    return await payloadPromise
  } catch (err) {
    console.warn('[nuxt] Cannot load payload ', payloadURL, err)
  }
  return null
}
/** @since 3.0.0 */
export async function isPrerendered (url = useRoute().path) {
  // Note: Alternative for server is checking x-nitro-prerender header
  if (!appManifest) { return !!useNuxtApp().payload.prerenderedAt }
  url = withoutTrailingSlash(url)
  const manifest = await getAppManifest()
  if (manifest.prerendered.includes(url)) {
    return true
  }
  const rules = await getRouteRules(url)
  return !!rules.prerender && !rules.redirect
}

let payloadCache: NuxtPayload | null = null

/** @since 3.4.0 */
export async function getNuxtClientPayload () {
  if (import.meta.server) {
    return null
  }
  if (payloadCache) {
    return payloadCache
  }

  const el = multiApp ? document.querySelector(`[data-nuxt-data="${appId}"]`) as HTMLElement : document.getElementById('__NUXT_DATA__')
  if (!el) {
    return {} as Partial<NuxtPayload>
  }

  const inlineData = await parsePayload(el.textContent || '')

  const externalData = el.dataset.src ? await _importPayload(el.dataset.src) : undefined

  payloadCache = {
    ...inlineData,
    ...externalData,
    ...(multiApp ? window.__NUXT__?.[appId] : window.__NUXT__),
  }

  if (payloadCache!.config?.public) {
    payloadCache!.config.public = reactive(payloadCache!.config.public)
  }

  return payloadCache
}

export async function parsePayload (payload: string) {
  return await parse(payload, useNuxtApp()._payloadRevivers)
}

/**
 * This is an experimental function for configuring passing rich data from server -> client.
 * @since 3.4.0
 */
export function definePayloadReducer (
  name: string,
  reduce: (data: any) => any,
) {
  if (import.meta.server) {
    useNuxtApp().ssrContext!._payloadReducers[name] = reduce
  }
}

/**
 * This is an experimental function for configuring passing rich data from server -> client.
 *
 * This function _must_ be called in a Nuxt plugin that is `unshift`ed to the beginning of the Nuxt plugins array.
 * @since 3.4.0
 */
export function definePayloadReviver (
  name: string,
  revive: (data: any) => any | undefined,
) {
  if (import.meta.dev && getCurrentInstance()) {
    console.warn('[nuxt] [definePayloadReviver] This function must be called in a Nuxt plugin that is `unshift`ed to the beginning of the Nuxt plugins array.')
  }
  if (import.meta.client) {
    useNuxtApp()._payloadRevivers[name] = revive
  }
}
