import type { RequestEvent } from '@nuxt/schema'
import type { $Fetch, NitroRouteRules } from 'nitropack/types'
import { useRuntimeConfig } from '../nuxt'
import { manifestDiagnostics } from '../diagnostics/manifest'
import { appManifest as isAppManifestEnabled } from '#build/nuxt.config.mjs'
import { buildAssetsURL } from '#internal/nuxt/paths'
import { $fetch as _$fetch } from '#build/fetch'
import _routeRulesMatcher from '#build/route-rules.mjs'

const $fetch = _$fetch as $Fetch

// hoisted so a circular import cannot hit the TDZ of the `#build/route-rules.mjs` default export
function routeRulesMatcher (path: string): NitroRouteRules {
  return (_routeRulesMatcher as (path: string) => NitroRouteRules)(path)
}

export interface NuxtAppManifestMeta {
  id: string
  timestamp: number
}

export interface NuxtAppManifest extends NuxtAppManifestMeta {
  prerendered: string[]
}

let manifest: Promise<NuxtAppManifest> | undefined

function fetchManifest (): Promise<NuxtAppManifest> {
  if (!isAppManifestEnabled) {
    throw manifestDiagnostics.NUXT_E5001()
  }
  let _manifest: Promise<NuxtAppManifest>
  if (import.meta.server) {
    _manifest = import(/* webpackIgnore: true */ /* @vite-ignore */ '#app-manifest') as unknown as Promise<NuxtAppManifest>
  } else {
    _manifest = $fetch<NuxtAppManifest>(buildAssetsURL(`builds/meta/${useRuntimeConfig().app.buildId}.json`), {
      responseType: 'json',
    }).then((res) => {
      // handle errors fetching manifest, e.g. from an improperly configured proxy
      if (!res || typeof res !== 'object' || !Array.isArray((res as NuxtAppManifest).prerendered)) {
        throw manifestDiagnostics.NUXT_E5004()
      }
      return res
    })
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

/** @since 3.7.4 */
export function getRouteRules (event: RequestEvent): NitroRouteRules
export function getRouteRules (options: { path: string }): Record<string, any>
/** @deprecated use `getRouteRules({ path })` instead */
export function getRouteRules (url: string): Record<string, any>
export function getRouteRules (arg: string | RequestEvent | { path: string }) {
  const path = typeof arg === 'string' ? arg : arg.path
  try {
    // The compiled matcher case-folds the lookup path itself (unless routing is
    // `sensitive`), so callers pass the path verbatim; folding here as well would
    // force case-insensitive matching even when `sensitive: true` is configured.
    return routeRulesMatcher(path)
  } catch (e) {
    manifestDiagnostics.NUXT_E5003({ path, cause: e })
    return {}
  }
}
