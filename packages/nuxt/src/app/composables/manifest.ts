import { joinURL } from 'ufo'
import type { RouteMatcher } from 'radix3'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { useRuntimeConfig } from '#app'
// @ts-expect-error virtual file
import { appManifest as isAppManifestEnabled } from '#build/nuxt.config.mjs'

export interface NuxtAppManifest {
  id: string
  timestamp: number
  routeRules: Record<string, any>
  prerendered: string[]
}

let manifest: Promise<NuxtAppManifest>
let matcher: RouteMatcher

export function getAppManifest (): Promise<NuxtAppManifest> {
  if (!isAppManifestEnabled) {
    throw new Error('[nuxt] app manifest should be enabled with `experimental.appManifest`')
  }
  const config = useRuntimeConfig()
  // TODO: use build id injected
  manifest ||= $fetch<NuxtAppManifest>(joinURL(config.app.cdnURL || config.app.baseURL, '_builds/latest.json'))
  return manifest
}

export async function getRouteRuleMatcher () {
  if (!isAppManifestEnabled) {
    throw new Error('[nuxt] app manifest should be enabled with `experimental.appManifest`')
  }
  const manifest = await getAppManifest()
  matcher ||= toRouteMatcher(
    createRadixRouter({ routes: manifest.routeRules })
  )
  return matcher
}
