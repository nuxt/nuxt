/**
 * This file is based on Vue.js (MIT) webpack plugins
 * https://github.com/vuejs/vue/blob/dev/src/server/webpack-plugin/client.js
 */

import { mkdir, writeFile } from 'node:fs/promises'

import { normalizeWebpackManifest } from 'vue-bundle-renderer'
import { dirname } from 'pathe'
import hash from 'hash-sum'

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
      filename: null,
    }, options)
  }

  apply (compiler: Compiler) {
    compiler.hooks.afterEmit.tap('VueSSRClientPlugin', async (compilation: Compilation) => {
      const stats = compilation.getStats().toJson()

      const initialFiles = new Set<string>()
      for (const { assets } of Object.values(stats.entrypoints!)) {
        if (!assets) { continue }

        for (const asset of assets) {
          const file = asset.name
          if ((isJS(file) || isCSS(file)) && !isHotUpdate(file)) {
            initialFiles.add(file)
          }
        }
      }

      const allFiles = new Set<string>()
      const asyncFiles = new Set<string>()
      const assetsMapping: Record<string, string[]> = {}

      for (const { name: file, chunkNames = [] } of stats.assets!) {
        if (isHotUpdate(file)) { continue }
        allFiles.add(file)
        const isFileJS = isJS(file)
        if (!initialFiles.has(file) && (isFileJS || isCSS(file))) {
          asyncFiles.add(file)
        }
        if (isFileJS) {
          const componentHash = hash(chunkNames.join('|'))
          const map = assetsMapping[componentHash] ||= []
          map.push(file)
        }
      }

      const webpackManifest = {
        publicPath: stats.publicPath,
        all: [...allFiles],
        initial: [...initialFiles],
        async: [...asyncFiles],
        modules: { /* [identifier: string]: Array<index: number> */ } as Record<string, number[]>,
        assetsMapping,
      }

      const { entrypoints = {}, namedChunkGroups = {} } = stats
      const fileToIndex = (file: string | number) => webpackManifest.all.indexOf(String(file))
      for (const m of stats.modules!) {
        // Ignore modules duplicated in multiple chunks
        if (m.chunks?.length !== 1) { continue }

        const [cid] = m.chunks
        const chunk = stats.chunks!.find(c => c.id === cid)
        if (!chunk || !chunk.files || !cid) {
          continue
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
        if (stats.modules) {
          for (const m of stats.modules) {
            if (m.assets?.length && m.chunks?.includes(cid)) {
              files.push(...m.assets.map(fileToIndex))
            }
          }
        }
      }

      const manifest = normalizeWebpackManifest(webpackManifest as any)
      await this.options.nuxt.callHook('build:manifest', manifest)

      const src = JSON.stringify(manifest, null, 2)

      await mkdir(dirname(this.options.filename), { recursive: true })
      await writeFile(this.options.filename, src)

      const mjsSrc = 'export default ' + src
      await writeFile(this.options.filename.replace('.json', '.mjs'), mjsSrc)

      // assets[this.options.filename] = {
      //   source: () => src,
      //   size: () => src.length
      // }
    })
  }
}
