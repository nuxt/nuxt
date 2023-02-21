import { joinURL, hasProtocol } from 'ufo'
import { parse } from 'devalue'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
import { useHead } from './head'

interface LoadPayloadOptions {
  fresh?: boolean
  hash?: string
}

export function loadPayload (url: string, opts: LoadPayloadOptions = {}) {
  if (process.server) { return null }
  const payloadURL = _getPayloadURL(url, opts)
  const nuxtApp = useNuxtApp()
  const cache = nuxtApp._payloadCache = nuxtApp._payloadCache || {}
  if (cache[url]) {
    return cache[url]
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
  const u = new URL(url, 'http://localhost')
  if (u.search) {
    throw new Error('Payload URL cannot contain search params: ' + url)
  }
  if (u.host !== 'localhost' || hasProtocol(u.pathname, true)) {
    throw new Error('Payload URL must not include hostname: ' + url)
  }
  const hash = opts.hash || (opts.fresh ? Date.now() : '')
  return joinURL(useRuntimeConfig().app.baseURL, u.pathname, hash ? `_payload.${hash}.js` : '_payload.js')
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

  const { revivers } = useNuxtPayloadTypes()

  const inlineData = parse(el.textContent || '', revivers)

  let externalData
  if (el.dataset.src) {
    const text = await fetch(el.dataset.src).then(res => res.text())
    externalData = parse(text, revivers)
  }

  payloadCache = {
    ...inlineData,
    ...externalData,
    ...window.__NUXT__
  }

  return payloadCache
}

export function useNuxtPayloadTypes () {
  const _globalThis = globalThis as any
  if (!_globalThis.__nuxt_payload_types__) {
    _globalThis.__nuxt_payload_types__ = {
      reducers: {},
      revivers: {}
    }
  }
  return _globalThis.__nuxt_payload_types__
}

export function definePayloadType (
  name: string,
  reduce: (data: any) => any,
  revive: (data: string) => any | undefined
) {
  const types = useNuxtPayloadTypes()
  if (process.client) {
    types.revivers[name] = revive
  }
  if (process.server) {
    types.reducers[name] = reduce
  }
}
