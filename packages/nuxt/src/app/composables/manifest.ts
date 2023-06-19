import { useRuntimeConfig } from "#app"
import { joinURL } from "ufo"

export interface NuxtAppManifest {
  id: string
  timestamp: number
  routeRules: Record<string, any>
  prerendered: string[]
}

// TODO: use build id injected
let manifest: NuxtAppManifest

export async function getAppManifest () {
  const config = useRuntimeConfig()
  return manifest = manifest || $fetch(joinURL(config.app.buildAssetsURL, 'builds/latest.json'))
}
