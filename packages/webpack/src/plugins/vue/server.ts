import type { Compilation, Compiler } from 'webpack'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import { isJS, validate } from './util.ts'
import { webpack } from '../../builder.ts'

const JS_MAP_RE = /\.js\.map$/

/**
 * Check that the server build has a single JS entry, and drop the non-JS assets it emits.
 */
export default class VueSSRServerPlugin {
  apply (compiler: Compiler) {
    validate(compiler)
    compiler.hooks.make.tap('VueSSRServerPlugin', (compilation: Compilation) => {
      compilation.hooks.processAssets.tap({
        name: 'VueSSRServerPlugin',
        stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
      }, (assets) => {
        const stats = compilation.getStats().toJson({
          assets: true,
          entrypoints: true,
        })
        const [entryName] = Object.keys(stats.entrypoints!)
        const entryInfo = stats.entrypoints![entryName!]

        if (!entryInfo) {
          // #5553
          return
        }

        const entryAssets = entryInfo.assets!.filter(asset => isJS(asset.name))

        if (entryAssets.length > 1) {
          throw bundlerDiagnostics.NUXT_B7003()
        }

        if (typeof entryAssets[0]?.name !== 'string') {
          throw bundlerDiagnostics.NUXT_B7004({ entryName: entryName! })
        }

        for (const asset of stats.assets!) {
          if (!isJS(asset.name) && !JS_MAP_RE.test(asset.name)) {
            delete assets[asset.name]
          }
        }
      })
    })
  }
}
