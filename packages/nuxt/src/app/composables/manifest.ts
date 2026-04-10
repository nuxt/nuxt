import type { H3Event } from '@nuxt/nitro-server/h3'
import type { NitroRouteRules } from 'nitro/types'
import { useRuntimeConfig } from '../nuxt'
// @ts-expect-error virtual file
import { appManifest as isAppManifestEnabled } from '#build/nuxt.config.mjs'
// @ts-expect-error virtual file
import { buildAssetsURL } from '#internal/nuxt/paths'
// @ts-expect-error virtual file
import _routeRulesMatcher from '#build/route-rules.mjs'

const routeRulesMatcher = _routeRulesMatcher as (path: string) => NitroRouteRules

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
    throw new Error('[nuxt] app manifest should be enabled with `experimental.appManifest`')
  }
  let _manifest: Promise<NuxtAppManifest>
  if (import.meta.server) {
    // @ts-expect-error virtual file
    _manifest = import(/* webpackIgnore: true */ /* @vite-ignore */ '#app-manifest')
  } else {
    _manifest = $fetch<NuxtAppManifest>(buildAssetsURL(`builds/meta/${useRuntimeConfig().app.buildId}.json`), {
      responseType: 'json',
    })
  }
  manifest = _manifest
  _manifest.catch((e) => {
    // Reset so subsequent calls to getAppManifest() retry instead of
    // returning the same rejected promise permanently.
    if (manifest === _manifest) {
      manifest = undefined
    }
    console.error('[nuxt] Error fetching app manifest.', e)
  })
  return _manifest
}

/** @since 3.7.4 */
export function getAppManifest (): Promise<NuxtAppManifest> {
  if (!isAppManifestEnabled) {
    throw new Error('[nuxt] app manifest should be enabled with `experimental.appManifest`')
  }
  return manifest || fetchManifest()
}

/** @since 3.7.4 */
export function getRouteRules (event: H3Event): NitroRouteRules
export function getRouteRules (options: { path: string }): Record<string, any>
/** @deprecated use `getRouteRules({ path })` instead */
export function getRouteRules (url: string): Record<string, any>
export function getRouteRules (arg: string | H3Event | { path: string }) {
  const path = typeof arg === 'string' ? arg : 'url' in arg ? arg.url.pathname : arg.path
  try {
    return routeRulesMatcher(path)
  } catch (e) {
    console.error('[nuxt] Error matching route rules.', e)
    return {}
  }
}
