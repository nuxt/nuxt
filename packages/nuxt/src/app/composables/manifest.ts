import type { MatcherExport, RouteMatcher } from 'radix3'
import { createMatcherFromExport, createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { defu } from 'defu'
import { useAppConfig } from '../config'
import { useRuntimeConfig } from '../nuxt'
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
  // @ts-expect-error private property
  const buildId = useAppConfig().nuxt?.buildId
  manifest = $fetch<NuxtAppManifest>(buildAssetsURL(`builds/meta/${buildId}.json`))
  manifest.then((m) => {
    matcher = createMatcherFromExport(m.matcher)
  })
  return manifest
}

/** @since 3.7.4 */
export function getAppManifest (): Promise<NuxtAppManifest> {
  if (!isAppManifestEnabled) {
    throw new Error('[nuxt] app manifest should be enabled with `experimental.appManifest`')
  }
  return manifest || fetchManifest()
}

/** @since 3.7.4 */
export async function getRouteRules (url: string) {
  if (import.meta.server) {
    const _routeRulesMatcher = toRouteMatcher(
      createRadixRouter({ routes: useRuntimeConfig().nitro!.routeRules })
    )
    return defu({} as Record<string, any>, ..._routeRulesMatcher.matchAll(url).reverse())
  }
  await getAppManifest()
  return defu({} as Record<string, any>, ...matcher.matchAll(url).reverse())
}
