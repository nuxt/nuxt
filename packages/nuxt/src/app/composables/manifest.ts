import type { AppRouteRules, NuxtRequestEvent } from '@nuxt/schema'
import { withoutBase } from 'ufo'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
import type { NuxtApp } from '../nuxt'
import { manifestDiagnostics } from '../diagnostics/manifest'
import { appManifest as isAppManifestEnabled } from '#build/nuxt.config.mjs'
import { buildAssetsURL } from '#internal/nuxt/paths'
import _routeRulesMatcher from '#build/route-rules.mjs'

// hoisted so a circular import cannot hit the TDZ of the `#build/route-rules.mjs` default export
function routeRulesMatcher (path: string): AppRouteRules {
  return (_routeRulesMatcher as (path: string) => AppRouteRules)(path)
}

export interface NuxtAppManifestMeta {
  id: string
  timestamp: number
}

export interface NuxtAppManifest extends NuxtAppManifestMeta {
  prerendered: string[]
}

const UPDATE_CHECK_TIMEOUT = 30_000
let manifest: Promise<NuxtAppManifest> | undefined

function fetchManifest (): Promise<NuxtAppManifest> {
  if (!isAppManifestEnabled) {
    throw manifestDiagnostics.NUXT_E5001()
  }
  let _manifest: Promise<NuxtAppManifest>
  if (import.meta.server) {
    _manifest = import(/* webpackIgnore: true */ /* @vite-ignore */ '#app-manifest') as unknown as Promise<NuxtAppManifest>
  } else {
    const url = buildAssetsURL(`builds/meta/${useRuntimeConfig().app.buildId}.json`)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT)
    // Low priority so this background warm-up does not contend with LCP-critical resources.
    _manifest = fetch(url, { priority: 'low', signal: controller.signal })
      .then((res) => {
        // native `fetch` resolves non-2xx responses; surface them with a `status` so callers
        // (e.g. the outdated-build check) can distinguish a missing manifest from a bad payload
        if (!res.ok) {
          const error = new Error(`[nuxt] Could not fetch app manifest: ${res.status} ${res.statusText}`) as Error & { status: number }
          error.status = res.status
          throw error
        }
        return res.json()
      })
      .then((res: NuxtAppManifest) => {
        // handle errors fetching manifest, e.g. from an improperly configured proxy
        if (!res || typeof res !== 'object' || typeof res.id !== 'string' || typeof res.timestamp !== 'number' || !Array.isArray(res.prerendered)) {
          throw manifestDiagnostics.NUXT_E5004()
        }
        return res
      })
      .finally(() => clearTimeout(timeout))
  }
  manifest = _manifest
  _manifest.catch((e) => {
    // Reset so subsequent calls to getAppManifest() retry instead of
    // returning the same rejected promise permanently.
    if (manifest === _manifest) {
      manifest = undefined
    }
    manifestDiagnostics.NUXT_E5002({ cause: e })
  })
  return _manifest
}

/** @since 3.7.4 */
export function getAppManifest (): Promise<NuxtAppManifest> {
  if (!isAppManifestEnabled) {
    throw manifestDiagnostics.NUXT_E5001()
  }
  return manifest || fetchManifest()
}

const pendingUpdateChecks = new WeakMap<NuxtApp, Promise<NuxtAppManifestMeta | undefined>>()

/** Check for a newer deployment and emit `app:manifest:update` if one is available. */
export function checkForAppUpdate (): Promise<NuxtAppManifestMeta | undefined> {
  if (import.meta.server || !isAppManifestEnabled) { return Promise.resolve(undefined) }

  const nuxtApp = useNuxtApp()
  const pending = pendingUpdateChecks.get(nuxtApp)
  if (pending) { return pending }

  const promise = checkLatestManifest(nuxtApp).finally(() => {
    pendingUpdateChecks.delete(nuxtApp)
  })
  pendingUpdateChecks.set(nuxtApp, promise)
  return promise
}

async function checkLatestManifest (nuxtApp: NuxtApp): Promise<NuxtAppManifestMeta | undefined> {
  let currentManifest: NuxtAppManifestMeta | undefined
  try {
    currentManifest = await getAppManifest()
  } catch (e) {
    const err = e as { status?: number } & Error
    // The build is already outdated but the manifest was not cached.
    if (!('status' in err && (err.status === 404 || err.status === 403))) {
      throw err
    }
  }

  let meta: NuxtAppManifestMeta
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT)
  try {
    const res = await fetch(buildAssetsURL('builds/latest.json') + `?${Date.now()}`, { priority: 'low', signal: controller.signal })
    if (!res.ok) { return }
    meta = await res.json() as NuxtAppManifestMeta
    if (!meta || typeof meta.id !== 'string' || typeof meta.timestamp !== 'number') { return }
  } catch {
    // Fail gracefully on network issues and timeouts.
    return
  } finally {
    clearTimeout(timeout)
  }

  if (meta.id !== currentManifest?.id) {
    await nuxtApp.hooks.callHook('app:manifest:update', meta)
    return meta
  }
}

/** @since 3.7.4 */
export function getRouteRules (event: NuxtRequestEvent): AppRouteRules
export function getRouteRules (options: { path: string }): Record<string, any>
/** @deprecated use `getRouteRules({ path })` instead */
export function getRouteRules (url: string): Record<string, any>
export function getRouteRules (arg: string | NuxtRequestEvent | { path: string }) {
  const path = typeof arg === 'string' ? arg : 'url' in arg ? withoutBase(arg.url.pathname, useRuntimeConfig().app.baseURL) : arg.path
  try {
    return routeRulesMatcher(path)
  } catch (e) {
    manifestDiagnostics.NUXT_E5003({ path, cause: e })
    return {}
  }
}
