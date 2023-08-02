import { joinURL } from 'ufo'
import type { RouteMatcher } from 'radix3'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { defu } from 'defu'
import { useRuntimeConfig } from '#app'
// @ts-expect-error virtual file
import { appManifest as isAppManifestEnabled } from '#build/nuxt.config.mjs'

export interface NuxtAppManifest {
  id: string
  timestamp: number
  routeRules: Record<string, any>
  prerendered: string[]
}

let timeout: NodeJS.Timeout
let manifest: Promise<NuxtAppManifest>
let matcher: RouteMatcher

function fetchManifest () {
  if (!isAppManifestEnabled) {
    throw new Error('[nuxt] app manifest should be enabled with `experimental.appManifest`')
  }
  const config = useRuntimeConfig()
  // TODO: use build id injected
  manifest = $fetch<NuxtAppManifest>(joinURL(config.app.cdnURL || config.app.baseURL, '_builds/latest.json'))
  manifest.then((m) => {
    matcher = toRouteMatcher(
      createRadixRouter({ routes: m.routeRules })
    )
  })
  if (process.client) {
    clearTimeout(timeout)
    timeout = setTimeout(fetchManifest, 1000 * 60 * 60)
  }
  return manifest
}

export function getAppManifest (): Promise<NuxtAppManifest> {
  if (!isAppManifestEnabled) {
    throw new Error('[nuxt] app manifest should be enabled with `experimental.appManifest`')
  }
  return manifest || fetchManifest()
}

export async function getRouteRules (url: string) {
  if (!isAppManifestEnabled) {
    throw new Error('[nuxt] app manifest should be enabled with `experimental.appManifest`')
  }
  await getAppManifest()
  return defu({} as Record<string, any>, ...matcher.matchAll(url).reverse())
}
