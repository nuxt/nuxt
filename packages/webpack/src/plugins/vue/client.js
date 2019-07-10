/**
 * This file is based on Vue.js (MIT) webpack plugins
 * https://github.com/vuejs/vue/blob/dev/src/server/webpack-plugin/client.js
 */

import hash from 'hash-sum'
import uniq from 'lodash/uniq'

import { isJS, isCSS } from './util'

export default class VueSSRClientPlugin {
  constructor (options = {}) {
    this.options = Object.assign({
      filename: null
    }, options)
  }

  apply (compiler) {
    compiler.hooks.emit.tapAsync('vue-client-plugin', (compilation, cb) => {
      const stats = compilation.getStats().toJson()

      const allFiles = uniq(stats.assets
        .map(a => a.name))

      const initialFiles = uniq(Object.keys(stats.entrypoints)
        .map(name => stats.entrypoints[name].assets)
        .reduce((assets, all) => all.concat(assets), [])
        .filter(file => isJS(file) || isCSS(file)))

      const asyncFiles = allFiles
        .filter(file => isJS(file) || isCSS(file))
        .filter(file => !initialFiles.includes(file))

      const assetsMapping = {}
      stats.assets
        .filter(({ name }) => isJS(name))
        .forEach(({ name, chunkNames }) => {
          assetsMapping[name] = hash(chunkNames.join('|'))
        })

      const manifest = {
        publicPath: stats.publicPath,
        all: allFiles,
        initial: initialFiles,
        async: asyncFiles,
        modules: { /* [identifier: string]: Array<index: number> */ },
        assetsMapping
      }

      const assetModules = stats.modules.filter(m => m.assets.length)
      const fileToIndex = file => manifest.all.indexOf(file)
      stats.modules.forEach((m) => {
        // Ignore modules duplicated in multiple chunks
        if (m.chunks.length === 1) {
          const [cid] = m.chunks
          const chunk = stats.chunks.find(c => c.id === cid)
          if (!chunk || !chunk.files) {
            return
          }
          const id = m.identifier.replace(/\s\w+$/, '') // remove appended hash
          const files = manifest.modules[hash(id)] = chunk.files.map(fileToIndex)

          // In production mode, modules may be concatenated by scope hoisting
          // Include ConcatenatedModule for not losing module-component mapping
          if (Array.isArray(m.modules)) {
            for (const concatenatedModule of m.modules) {
              const id = hash(concatenatedModule.identifier.replace(/\s\w+$/, ''))
              if (!manifest.modules[id]) {
                manifest.modules[id] = files
              }
            }
          }

          // Find all asset modules associated with the same chunk
          assetModules.forEach((m) => {
            if (m.chunks.some(id => id === cid)) {
              files.push.apply(files, m.assets.map(fileToIndex))
            }
          })
        }
      })

      const src = JSON.stringify(manifest, null, 2)

      compilation.assets[this.options.filename] = {
        source: () => src,
        size: () => src.length
      }
      cb()
    })
  }
}
