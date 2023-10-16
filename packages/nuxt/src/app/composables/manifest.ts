import { joinURL } from 'ufo'
import type { MatcherExport, RouteMatcher } from 'radix3'
import { createMatcherFromExport } from 'radix3'
import { defu } from 'defu'
import { useAppConfig, useRuntimeConfig } from '#app'
// @ts-expect-error virtual file
import { appManifest as isAppManifestEnabled } from '#build/nuxt.config.mjs'

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
  const config = useRuntimeConfig()
  // @ts-expect-error private property
  const buildId = useAppConfig().nuxt?.buildId
  manifest = $fetch<NuxtAppManifest>(joinURL(config.app.cdnURL || config.app.baseURL, config.app.buildAssetsDir, `builds/meta/${buildId}.json`))
  manifest.then((m) => {
    matcher = createMatcherFromExport(m.matcher)
  })
  return manifest
}

export function getAppManifest (): Promise<NuxtAppManifest> {
  if (!isAppManifestEnabled) {
    throw new Error('[nuxt] app manifest should be enabled with `experimental.appManifest`')
  }
  return manifest || fetchManifest()
}

export async function getRouteRules (url: string) {
  await getAppManifest()
  return defu({} as Record<string, any>, ...matcher.matchAll(url).reverse())
}
