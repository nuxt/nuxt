import { hasProtocol, joinURL } from 'ufo'
import { parse } from 'devalue'
import { useHead } from '@unhead/vue'
import { getCurrentInstance } from 'vue'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'

import { getAppManifest, getRouteRules } from '#app/composables/manifest'
import { useRoute } from '#app/composables'

// @ts-expect-error virtual import
import { appManifest, payloadExtraction, renderJsonPayloads } from '#build/nuxt.config.mjs'

interface LoadPayloadOptions {
  fresh?: boolean
  hash?: string
}

export function loadPayload (url: string, opts: LoadPayloadOptions = {}): Record<string, any> | Promise<Record<string, any>> | null {
  if (import.meta.server || !payloadExtraction) { return null }
  const payloadURL = _getPayloadURL(url, opts)
  const nuxtApp = useNuxtApp()
  const cache = nuxtApp._payloadCache = nuxtApp._payloadCache || {}
  if (payloadURL in cache) {
    return cache[payloadURL]
  }
  cache[payloadURL] = isPrerendered().then((prerendered) => {
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

export function preloadPayload (url: string, opts: LoadPayloadOptions = {}) {
  const payloadURL = _getPayloadURL(url, opts)
  useHead({
    link: [
      { rel: 'modulepreload', href: payloadURL }
    ]
  })
}

// --- Internal ---

const extension = renderJsonPayloads ? 'json' : 'js'
function _getPayloadURL (url: string, opts: LoadPayloadOptions = {}) {
  const u = new URL(url, 'http://localhost')
  if (u.search) {
    throw new Error('Payload URL cannot contain search params: ' + url)
  }
  if (u.host !== 'localhost' || hasProtocol(u.pathname, { acceptRelative: true })) {
    throw new Error('Payload URL must not include hostname: ' + url)
  }
  const hash = opts.hash || (opts.fresh ? Date.now() : '')
  return joinURL(useRuntimeConfig().app.baseURL, u.pathname, hash ? `_payload.${hash}.${extension}` : `_payload.${extension}`)
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

export async function isPrerendered (url = useRoute().path) {
  // Note: Alternative for server is checking x-nitro-prerender header
  const nuxtApp = useNuxtApp()
  if (!appManifest) { return !!nuxtApp.payload.prerenderedAt }
  const manifest = await getAppManifest()
  if (manifest.prerendered.includes(url)) {
    return true
  }
  const rules = await getRouteRules(url)
  return !!rules.prerender && !rules.redirect
}

let payloadCache: any = null
export async function getNuxtClientPayload () {
  if (import.meta.server) {
    return
  }
  if (payloadCache) {
    return payloadCache
  }

  const el = document.getElementById('__NUXT_DATA__')
  if (!el) {
    return {}
  }

  const inlineData = parsePayload(el.textContent || '')

  const externalData = el.dataset.src ? await _importPayload(el.dataset.src) : undefined

  payloadCache = {
    ...inlineData,
    ...externalData,
    ...window.__NUXT__
  }

  return payloadCache
}

export function parsePayload (payload: string) {
  return parse(payload, useNuxtApp()._payloadRevivers)
}

/**
 * This is an experimental function for configuring passing rich data from server -> client.
 */
export function definePayloadReducer (
  name: string,
  reduce: (data: any) => any
) {
  if (import.meta.server) {
    useNuxtApp().ssrContext!._payloadReducers[name] = reduce
  }
}

/**
 * This is an experimental function for configuring passing rich data from server -> client.
 *
 * This function _must_ be called in a Nuxt plugin that is `unshift`ed to the beginning of the Nuxt plugins array.
 */
export function definePayloadReviver (
  name: string,
  revive: (data: any) => any | undefined
) {
  if (import.meta.dev && getCurrentInstance()) {
    console.warn('[nuxt] [definePayloadReviver] This function must be called in a Nuxt plugin that is `unshift`ed to the beginning of the Nuxt plugins array.')
  }
  if (import.meta.client) {
    useNuxtApp()._payloadRevivers[name] = revive
  }
}
