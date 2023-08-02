import { joinURL } from 'ufo'
import type { RouteMatcher } from 'radix3'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { useRuntimeConfig } from '#app'

export interface NuxtAppManifest {
  id: string
  timestamp: number
  routeRules: Record<string, any>
  prerendered: string[]
}

let manifest: Promise<NuxtAppManifest>
let matcher: RouteMatcher

export function getAppManifest (): Promise<NuxtAppManifest> {
  const config = useRuntimeConfig()
  // TODO: use build id injected
  manifest = manifest || $fetch<NuxtAppManifest>(joinURL(config.app.cdnURL || config.app.baseURL, '_builds/latest.json'))
  return manifest
}

export async function getRouteRuleMatcher () {
  const manifest = await getAppManifest()
  matcher = matcher || toRouteMatcher(
    createRadixRouter({ routes: manifest.routeRules })
  )
  return matcher
}
