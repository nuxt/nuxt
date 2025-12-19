import { defu } from 'defu'
import type { H3Event } from 'h3'
import type { NitroRouteRules } from 'nitropack'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
// @ts-expect-error virtual file
import { appManifest as isAppManifestEnabled } from '#build/nuxt.config.mjs'
// @ts-expect-error virtual file
import { buildAssetsURL } from '#internal/nuxt/paths'
// @ts-expect-error virtual file
import _routeRulesMatcher from '#build/route-rules.mjs'

const routeRulesMatcher = _routeRulesMatcher as (method: string, path: string) => Array<{ data: NitroRouteRules }>

export interface NuxtAppManifestMeta {
  id: string
  timestamp: number
}

export interface NuxtAppManifest extends NuxtAppManifestMeta {
  prerendered: string[]
}

let manifest: Promise<NuxtAppManifest>

function fetchManifest () {
  if (!isAppManifestEnabled) {
    throw new Error('[nuxt] app manifest should be enabled with `experimental.appManifest`')
  }
  if (import.meta.server) {
    // @ts-expect-error virtual file
    manifest = import('#app-manifest')
  } else {
    manifest = $fetch<NuxtAppManifest>(buildAssetsURL(`builds/meta/${useRuntimeConfig().app.buildId}.json`), {
      responseType: 'json',
    })
  }
  manifest.catch((e) => {
    console.error('[nuxt] Error fetching app manifest.', e)
  })
  return manifest
}

/** @since 3.7.4 */
export function getAppManifest (): Promise<NuxtAppManifest> {
  if (!isAppManifestEnabled) {
    throw new Error('[nuxt] app manifest should be enabled with `experimental.appManifest`')
  }
  if (import.meta.server) {
    useNuxtApp().ssrContext!['~preloadManifest'] = true
  }
  return manifest || fetchManifest()
}

/** @since 3.7.4 */
export function getRouteRules (event: H3Event): NitroRouteRules
export function getRouteRules (options: { path: string }): Record<string, any>
/** @deprecated use `getRouteRules({ path })` instead */
export function getRouteRules (url: string): Record<string, any>
export function getRouteRules (arg: string | H3Event | { path: string }) {
  const path = typeof arg === 'string' ? arg : arg.path
  try {
    return defu({} as Record<string, any>, ...routeRulesMatcher('', path).map(r => r.data).reverse())
  } catch (e) {
    console.error('[nuxt] Error matching route rules.', e)
    return {}
  }
}
