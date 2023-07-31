import { joinURL } from 'ufo'
import { useRuntimeConfig } from '#app'

export interface NuxtAppManifest {
  id: string
  timestamp: number
  routeRules: Record<string, any>
  prerendered: string[]
}

let manifest: Promise<NuxtAppManifest>

export function getAppManifest (): Promise<NuxtAppManifest> {
  const config = useRuntimeConfig()
  // TODO: use build id injected
  manifest = manifest || $fetch(joinURL(config.app.cdnURL || config.app.baseURL, '_builds/latest.json'))
  return manifest
}
