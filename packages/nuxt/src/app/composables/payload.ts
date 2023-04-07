import { joinURL, hasProtocol } from 'ufo'
import { parse } from 'devalue'
import { useHead } from '@unhead/vue'
import { getCurrentInstance } from 'vue'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'

// @ts-expect-error virtual import
import { renderJsonPayloads } from '#build/nuxt.config.mjs'

interface LoadPayloadOptions {
  fresh?: boolean
  hash?: string
}

export function loadPayload (url: string, opts: LoadPayloadOptions = {}): Record<string, any> | Promise<Record<string, any>> | null {
  if (process.server) { return null }
  const payloadURL = _getPayloadURL(url, opts)
  const nuxtApp = useNuxtApp()
  const cache = nuxtApp._payloadCache = nuxtApp._payloadCache || {}
  if (cache[payloadURL]) {
    return cache[payloadURL]
  }
  cache[payloadURL] = _importPayload(payloadURL).then((payload) => {
    if (!payload) {
      delete cache[payloadURL]
      return null
    }
    return payload
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
  if (process.server) { return null }
  try {
    return renderJsonPayloads
      ? parsePayload(await fetch(payloadURL).then(res => res.text()))
      : await import(/* webpackIgnore: true */ /* @vite-ignore */ payloadURL).then(r => r.default || r)
  } catch (err) {
    console.warn('[nuxt] Cannot load payload ', payloadURL, err)
  }
  return null
}

export function isPrerendered () {
  // Note: Alternative for server is checking x-nitro-prerender header
  const nuxtApp = useNuxtApp()
  return !!nuxtApp.payload.prerenderedAt
}

let payloadCache: any = null
export async function getNuxtClientPayload () {
  if (process.server) {
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
  if (process.server) {
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
  revive: (data: string) => any | undefined
) {
  if (process.dev && getCurrentInstance()) {
    console.warn('[nuxt] [definePayloadReviver] This function must be called in a Nuxt plugin that is `unshift`ed to the beginning of the Nuxt plugins array.')
  }
  if (process.client) {
    useNuxtApp()._payloadRevivers[name] = revive
  }
}
