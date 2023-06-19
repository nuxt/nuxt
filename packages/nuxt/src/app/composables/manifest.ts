export interface NuxtAppManifest {
  id: string
  timestamp: number
  routeRules: Record<string, any>
  prerendered: string[]
}

// TODO: use build id injected
let manifest: NuxtAppManifest

export async function getAppManifest () {
  return manifest = manifest || $fetch('/_nuxt/builds/latest.json')
}
