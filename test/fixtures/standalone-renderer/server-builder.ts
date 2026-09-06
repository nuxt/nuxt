import { join } from 'pathe'
import { setServerBuild } from '@nuxt/kit/internal'
import type { NuxtBuilder } from '@nuxt/schema'

/**
 * Stands in for a server builder that is neither nitro nor `@nuxt/vite-server`: it runs no
 * bundle of its own, so the app build emits its SSR entry as a bundle for this builder to
 * load, and the runtime modules that bundle imports are the ones this builder provides.
 */
export const bundle: NuxtBuilder['bundle'] = (nuxt) => {
  const runtimeDir = join(nuxt.options.buildDir, 'standalone')

  setServerBuild({
    name: 'standalone',
    label: 'Standalone renderer',
    capabilities: { server: true, dev: false },
    buildsSeparately: true,
    // `nitropack/runtime` does not resolve in a build without nitro
    runtime: {
      runtimeConfig: join(runtimeDir, 'runtime-config.mjs'),
    },
  }, nuxt)

  return Promise.resolve()
}

export default { bundle }
