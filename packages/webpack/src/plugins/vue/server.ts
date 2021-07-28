
import { Compilation } from 'webpack'
import { validate, isJS, extractQueryPartJS } from './util'

export default class VueSSRServerPlugin {
  options: {
    filename?: string
  }

  constructor (options = {}) {
    this.options = Object.assign({
      filename: null
    }, options)
  }

  apply (compiler) {
    validate(compiler)
    compiler.hooks.make.tap('VueSSRServerPlugin', (compilation: any) => {
      compilation.hooks.processAssets.tapAsync({
        name: 'VueSSRServerPlugin',
        stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
      }, (assets, cb) => {
        const stats = compilation.getStats().toJson()
        const [entryName] = Object.keys(stats.entrypoints)
        const entryInfo = stats.entrypoints[entryName]

        if (!entryInfo) {
          // #5553
          return cb()
        }

        const entryAssets = entryInfo.assets.filter(asset => isJS(asset.name))

        if (entryAssets.length > 1) {
          throw new Error(
            'Server-side bundle should have one single entry file. ' +
            'Avoid using CommonsChunkPlugin in the server config.'
          )
        }

        const [entry] = entryAssets
        if (!entry || typeof entry.name !== 'string') {
          throw new Error(
            `Entry "${entryName}" not found. Did you specify the correct entry option?`
          )
        }

        const bundle = {
          entry: entry.name,
          files: {},
          maps: {}
        }

        stats.assets.forEach((asset) => {
          if (isJS(asset.name)) {
            const queryPart = extractQueryPartJS(asset.name)
            if (queryPart !== undefined) {
              bundle.files[asset.name] = asset.name.replace(queryPart, '')
            } else {
              bundle.files[asset.name] = asset.name
            }
          } else if (asset.name.match(/\.js\.map$/)) {
            bundle.maps[asset.name.replace(/\.map$/, '')] = asset.name
          } else {
            // Do not emit non-js assets for server
            delete assets[asset.name]
          }
        })

        const src = JSON.stringify(bundle, null, 2)

        assets[this.options.filename] = {
          source: () => src,
          size: () => src.length
        }

        const mjsSrc = 'export default ' + src
        assets[this.options.filename.replace('.json', '.mjs')] = {
          source: () => mjsSrc,
          map: () => null,
          size: () => mjsSrc.length
        }

        // TODO: Workaround for webpack
        const serverJS = 'export { default } from "./server.cjs"'
        assets['server.mjs'] = {
          source: () => serverJS,
          map: () => null,
          size: () => serverJS.length
        }

        cb()
      })
    })
  }
}
