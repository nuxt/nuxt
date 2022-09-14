import { parseURL, joinURL } from 'ufo'
import { useNuxtApp } from '../nuxt'
import { useHead } from '..'

interface LoadPayloadOptions {
  fresh?: boolean
  hash?: string
}

export function loadPayload (url: string, opts: LoadPayloadOptions = {}) {
  if (process.server) { return null }
  const payloadURL = _getPayloadURL(url, opts)
  const nuxtApp = useNuxtApp()
  const cache = nuxtApp._payloadCache = nuxtApp._payloadCache || {}
  if (cache[payloadURL]) {
    return cache[payloadURL]
  }
  cache[url] = _importPayload(payloadURL).then((payload) => {
    if (!payload) {
      delete cache[url]
      return null
    }
    return payload
  })
  return cache[url]
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

function _getPayloadURL (url: string, opts: LoadPayloadOptions = {}) {
  const parsed = parseURL(url)
  if (parsed.search) {
    throw new Error('Payload URL cannot contain search params: ' + url)
  }
  const hash = opts.hash || (opts.fresh ? Date.now() : '')
  return joinURL(parsed.pathname, hash ? `_payload.${hash}.js` : '_payload.js')
}

async function _importPayload (payloadURL: string) {
  if (process.server) { return null }
  const res = await import(/* webpackIgnore: true */ /* @vite-ignore */ payloadURL).catch((err) => {
    console.warn('[nuxt] Cannot load payload ', payloadURL, err)
  })
  return res?.default || null
}

export function isPrerendered () {
  // Note: Alternative for server is checking x-nitro-prerender header
  const nuxtApp = useNuxtApp()
  return !!nuxtApp.payload.prerenderedAt
}
