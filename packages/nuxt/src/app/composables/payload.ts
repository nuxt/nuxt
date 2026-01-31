import { hasProtocol, joinURL } from 'ufo'
import { parse } from 'devalue'
import { getCurrentInstance, onServerPrefetch, reactive } from 'vue'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
import type { NuxtPayload } from '../nuxt'
import { useHead } from './head'

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
  if (await shouldLoadPayload(url)) {
    const payloadURL = await _getPayloadURL(url, opts)
    return await _importPayload(payloadURL) || null
  }
  return null
}
let linkRelType: string | undefined
function detectLinkRelType () {
  if (import.meta.server) { return 'preload' }
  if (linkRelType) { return linkRelType }
  const relList = document.createElement('link').relList
  linkRelType = relList && relList.supports && relList.supports('prefetch') ? 'prefetch' : 'preload'
  return linkRelType
}
/** @since 3.0.0 */
export function preloadPayload (url: string, opts: LoadPayloadOptions = {}): Promise<void> {
  const nuxtApp = useNuxtApp()
  const promise = _getPayloadURL(url, opts).then((payloadURL) => {
    const link = renderJsonPayloads
      ? { rel: detectLinkRelType(), as: 'fetch', crossorigin: 'anonymous', href: payloadURL } as const
      : { rel: 'modulepreload', crossorigin: '', href: payloadURL } as const

    if (import.meta.server) {
      nuxtApp.runWithContext(() => useHead({ link: [link] }))
    } else {
      const linkEl = document.createElement('link')
      for (const key of Object.keys(link) as Array<keyof typeof link>) {
        linkEl[key === 'crossorigin' ? 'crossOrigin' : key] = link[key]!
      }
      document.head.appendChild(linkEl)
      return new Promise<void>((resolve, reject) => {
        linkEl.addEventListener('load', () => resolve())
        linkEl.addEventListener('error', () => reject())
      })
    }
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
    ? fetch(payloadURL, { cache: 'force-cache' }).then(res => res.text().then(parsePayload))
    : import(/* webpackIgnore: true */ /* @vite-ignore */ payloadURL).then(r => r.default || r)

  try {
    return await payloadPromise
  } catch (err) {
    console.warn('[nuxt] Cannot load payload ', payloadURL, err)
  }
  return null
}

function _shouldLoadPrerenderedPayload (rules: Record<string, any>) {
  if (rules.redirect) {
    return false
  }
  if (rules.prerender) {
    return true
  }
}

async function _isPrerenderedInManifest (url: string) {
  // Note: Alternative for server is checking x-nitro-prerender header
  if (!appManifest) {
    return false
  }
  url = url === '/' ? url : url.replace(/\/$/, '')
  const manifest = await getAppManifest()
  return manifest.prerendered.includes(url)
}

/**
 * @internal
 */
export async function shouldLoadPayload (url = useRoute().path) {
  const rules = getRouteRules({ path: url })
  const res = _shouldLoadPrerenderedPayload(rules)
  if (res !== undefined) {
    return res
  }

  if (rules.payload) {
    return true
  }

  return await _isPrerenderedInManifest(url)
}

/** @since 3.0.0 */
export async function isPrerendered (url = useRoute().path) {
  const res = _shouldLoadPrerenderedPayload(getRouteRules({ path: url }))
  if (res !== undefined) {
    return res
  }

  return await _isPrerenderedInManifest(url)
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
    useNuxtApp().ssrContext!['~payloadReducers'][name] = reduce
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
