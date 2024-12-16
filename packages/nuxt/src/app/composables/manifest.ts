import type { MatcherExport, RouteMatcher } from 'radix3'
import { createMatcherFromExport, createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { defu } from 'defu'
import type { H3Event } from 'h3'
import type { NitroRouteRules } from 'nitro/types'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
// @ts-expect-error virtual file
import { appManifest as isAppManifestEnabled } from '#build/nuxt.config.mjs'
// @ts-expect-error virtual file
import { buildAssetsURL } from '#internal/nuxt/paths'

export interface NuxtAppManifestMeta {
  id: string
  timestamp: number
}

export interface NuxtAppManifest extends NuxtAppManifestMeta {
  matcher: MatcherExport
  prerendered: string[]
}

let manifest: Promise<NuxtAppManifest>
let matcher: RouteMatcher

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
  manifest.then((m) => {
    matcher = createMatcherFromExport(m.matcher)
  }).catch((e) => {
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
    useNuxtApp().ssrContext!._preloadManifest = true
  }
  return manifest || fetchManifest()
}

/** @since 3.7.4 */
export async function getRouteRules (event: H3Event): Promise<NitroRouteRules>
export async function getRouteRules (options: { path: string }): Promise<Record<string, any>>
/** @deprecated use `getRouteRules({ path })` instead */
export async function getRouteRules (url: string): Promise<Record<string, any>>
export async function getRouteRules (arg: string | H3Event | { path: string }) {
  const path = typeof arg === 'string' ? arg : arg.path
  if (import.meta.server) {
    useNuxtApp().ssrContext!._preloadManifest = true
    const _routeRulesMatcher = toRouteMatcher(
      createRadixRouter({ routes: useRuntimeConfig().nitro!.routeRules }),
    )
    return defu({} as Record<string, any>, ..._routeRulesMatcher.matchAll(path).reverse())
  }
  await getAppManifest()
  if (!matcher) {
    console.error('[nuxt] Error creating app manifest matcher.', matcher)
    return {}
  }
  try {
    return defu({} as Record<string, any>, ...matcher.matchAll(path).reverse())
  } catch (e) {
    console.error('[nuxt] Error matching route rules.', e)
    return {}
  }
}
