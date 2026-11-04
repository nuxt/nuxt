import type { Nuxt } from '@nuxt/schema'
import type { RsbuildPlugin } from '@rsbuild/core'

import { appendModuleIdentifier, getModuleIdentifier } from '../../../webpack/src/loaders/vue-module-identifier.ts'
import { clientManifestStatsOptions, createClientManifestEmitter } from '../../../webpack/src/plugins/vue/manifest.ts'

/**
 * Generate the client manifest used by `vue-bundle-renderer` to render resource hints
 * for the components rendered on the server.
 */
export function VueSSRPlugin (nuxt: Nuxt): RsbuildPlugin {
  return {
    name: 'nuxt:vue-ssr',
    setup (api) {
      api.transform({ test: /\.vue$/, environments: ['ssr'], order: 'post' }, ({ code, resourcePath, resourceQuery }) => {
        if (resourceQuery || !code.includes('__exports__')) {
          return code
        }
        return appendModuleIdentifier(code, getModuleIdentifier(resourcePath, nuxt.options.srcDir))
      })

      const emitManifest = createClientManifestEmitter(nuxt)
      api.onAfterEnvironmentCompile(async ({ environment, stats }) => {
        if (environment.name === 'client' && stats) {
          await emitManifest(stats.toJson(clientManifestStatsOptions))
        }
      })
    },
  }
}
