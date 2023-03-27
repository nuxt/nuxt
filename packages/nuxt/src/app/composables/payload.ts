import { joinURL, hasProtocol } from 'ufo'
import { isShallow, isRef, isReactive, reactive, ref, shallowRef, toRaw } from 'vue'
import { parse } from 'devalue'
import { useHead } from '@unhead/vue'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
import { createError, isNuxtError } from './error'

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

function _getPayloadURL (url: string, opts: LoadPayloadOptions = {}) {
  const u = new URL(url, 'http://localhost')
  if (u.search) {
    throw new Error('Payload URL cannot contain search params: ' + url)
  }
  if (u.host !== 'localhost' || hasProtocol(u.pathname, { acceptRelative: true })) {
    throw new Error('Payload URL must not include hostname: ' + url)
  }
  const hash = opts.hash || (opts.fresh ? Date.now() : '')
  return joinURL(useRuntimeConfig().app.baseURL, u.pathname, hash ? `_payload.${hash}.json` : '_payload.json')
}

async function _importPayload (payloadURL: string) {
  if (process.server) { return null }
  try {
    const text = await fetch(payloadURL).then(res => res.text())
    const { revivers } = useNuxtPayloadTypes()
    return parse(text, revivers)
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

  const { revivers } = useNuxtPayloadTypes()

  const inlineData = parse(el.textContent || '', revivers)

  const externalData = el.dataset.src ? await _importPayload(el.dataset.src) : undefined

  payloadCache = {
    // For backwards compatibility - TODO: remove later
    config: window.__NUXT_CONFIG__,
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
      reducers: {
        NuxtError: (data: any) => isNuxtError(data) && data.toJSON(),
        shallowRef: (data: any) => isRef(data) && isShallow(data) && data.value,
        ref: (data: any) => isRef(data) && data.value,
        reactive: (data: any) => isReactive(data) && toRaw(data)
      },
      revivers: {
        NuxtError: (data: any) => createError(data),
        shallowRef: (data: any) => shallowRef(data),
        ref: (data: any) => ref(data),
        reactive: (data: any) => reactive(data)
      }
    }
  }
  return _globalThis.__nuxt_payload_types__
}

export function definePayloadReducer (
  name: string,
  reduce: (data: any) => any
) {
  if (process.server) {
    const types = useNuxtPayloadTypes()
    types.reducers[name] = reduce
  }
}

export function definePayloadReviver (
  name: string,
  revive: (data: string) => any | undefined
) {
  if (process.client) {
    const types = useNuxtPayloadTypes()
    types.revivers[name] = revive
  }
}
