import type { Nuxt } from '@nuxt/schema'
import type { RsbuildPlugin, Rspack } from '@rsbuild/core'

import { RollupCompatDynamicImportPlugin } from '../../../webpack/src/plugins/rollup-compat-dynamic-import.ts'
import { StripInvalidPureAnnotationsPlugin } from '../../../webpack/src/plugins/strip-invalid-pure-annotations.ts'

/**
 * Adapt the server build to be bundled by Nitro.
 */
export function ServerPlugin (nuxt: Nuxt): RsbuildPlugin {
  return {
    name: 'nuxt:server',
    setup (api) {
      api.modifyRspackConfig((config, { environment }) => {
        if (environment.name !== 'ssr') { return }
        if (nuxt.options.dev) {
          // Nitro loads the server bundle from memory as a single file in development
          config.output ||= {}
          config.output.asyncChunks = false
          return
        }
        config.plugins ||= []
        config.plugins.push(
          new RollupCompatDynamicImportPlugin() as unknown as Rspack.RspackPluginInstance,
          new StripInvalidPureAnnotationsPlugin() as unknown as Rspack.RspackPluginInstance,
        )
      })
    },
  }
}
