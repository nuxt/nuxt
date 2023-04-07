/**
 * This file is based on Vue.js (MIT) webpack plugins
 * https://github.com/vuejs/vue/blob/dev/src/server/webpack-plugin/client.js
 */

import { normalizeWebpackManifest } from 'vue-bundle-renderer'
import { dirname } from 'pathe'
import hash from 'hash-sum'
import { uniq } from 'lodash-es'
import fse from 'fs-extra'

import type { Nuxt } from '@nuxt/schema'
import type { Compilation, Compiler } from 'webpack'
import { isCSS, isHotUpdate, isJS } from './util'

interface PluginOptions {
  filename: string
  nuxt: Nuxt
}

export default class VueSSRClientPlugin {
  options: PluginOptions

  constructor (options: PluginOptions) {
    this.options = Object.assign({
      filename: null
    }, options)
  }

  apply (compiler: Compiler) {
    compiler.hooks.afterEmit.tap('VueSSRClientPlugin', async (compilation: Compilation) => {
      const stats = compilation.getStats().toJson()

      const allFiles = uniq(stats.assets!
        .map(a => a.name))
        .filter(file => !isHotUpdate(file))

      const initialFiles = uniq(Object.keys(stats.entrypoints!)
        .map(name => stats.entrypoints![name].assets!)
        .reduce((files, entryAssets) => files.concat(entryAssets.map(entryAsset => entryAsset.name)), [] as string[])
        .filter(file => isJS(file) || isCSS(file)))
        .filter(file => !isHotUpdate(file))

      const asyncFiles = allFiles
        .filter(file => isJS(file) || isCSS(file))
        .filter(file => !initialFiles.includes(file))
        .filter(file => !isHotUpdate(file))

      const assetsMapping: Record<string, string[]> = {}
      stats.assets!
        .filter(({ name }) => isJS(name))
        .filter(({ name }) => !isHotUpdate(name))
        .forEach(({ name, chunkNames = [] }) => {
          const componentHash = hash(chunkNames.join('|'))
          if (!assetsMapping[componentHash]) {
            assetsMapping[componentHash] = []
          }
          assetsMapping[componentHash].push(name)
        })

      const webpackManifest = {
        publicPath: stats.publicPath,
        all: allFiles,
        initial: initialFiles,
        async: asyncFiles,
        modules: { /* [identifier: string]: Array<index: number> */ } as Record<string, number[]>,
        assetsMapping
      }

      const { entrypoints = {}, namedChunkGroups = {} } = stats
      const assetModules = stats.modules!.filter(m => m.assets!.length)
      const fileToIndex = (file: string) => webpackManifest.all.indexOf(file)
      stats.modules!.forEach((m) => {
        // Ignore modules duplicated in multiple chunks
        if (m.chunks!.length === 1) {
          const [cid] = m.chunks!
          const chunk = stats.chunks!.find(c => c.id === cid)
          if (!chunk || !chunk.files) {
            return
          }
          const id = m.identifier!.replace(/\s\w+$/, '') // remove appended hash
          const filesSet = new Set(chunk.files.map(fileToIndex).filter(i => i !== -1))

          for (const chunkName of chunk.names!) {
            if (!entrypoints[chunkName]) {
              const chunkGroup = namedChunkGroups[chunkName]
              if (chunkGroup) {
                for (const asset of chunkGroup.assets!) {
                  filesSet.add(fileToIndex(asset.name))
                }
              }
            }
          }

          const files = Array.from(filesSet)
          webpackManifest.modules[hash(id)] = files

          // In production mode, modules may be concatenated by scope hoisting
          // Include ConcatenatedModule for not losing module-component mapping
          if (Array.isArray(m.modules)) {
            for (const concatenatedModule of m.modules) {
              const id = hash(concatenatedModule.identifier!.replace(/\s\w+$/, ''))
              if (!webpackManifest.modules[id]) {
                webpackManifest.modules[id] = files
              }
            }
          }

          // Find all asset modules associated with the same chunk
          assetModules.forEach((m) => {
            if (m.chunks!.includes(cid)) {
              files.push(...(m.assets as string[]).map(fileToIndex))
            }
          })
        }
      })

      const manifest = normalizeWebpackManifest(webpackManifest as any)
      await this.options.nuxt.callHook('build:manifest', manifest)

      const src = JSON.stringify(manifest, null, 2)

      await fse.mkdirp(dirname(this.options.filename))
      await fse.writeFile(this.options.filename, src)

      const mjsSrc = 'export default ' + src
      await fse.writeFile(this.options.filename.replace('.json', '.mjs'), mjsSrc)

      // assets[this.options.filename] = {
      //   source: () => src,
      //   size: () => src.length
      // }
    })
  }
}
