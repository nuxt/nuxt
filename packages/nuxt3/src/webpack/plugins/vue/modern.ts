/*
* This file is based on @vue/cli-service (MIT) ModernModePlugin
* https://github.com/vuejs/vue-cli/blob/dev/packages/@vue/cli-service/lib/webpack/ModernModePlugin.js
*/

import EventEmitter from 'events'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import { safariNoModuleFix } from 'nuxt/utils'

const assetsMap = {}
const watcher = new EventEmitter()

export default class ModernModePlugin {
  constructor ({ targetDir, isModernBuild, noUnsafeInline }) {
    this.targetDir = targetDir
    this.isModernBuild = isModernBuild
    this.noUnsafeInline = noUnsafeInline
  }

  apply (compiler) {
    if (!this.isModernBuild) {
      this.applyLegacy(compiler)
    } else {
      this.applyModern(compiler)
    }
  }

  get assets () {
    return assetsMap
  }

  set assets ({ name, content }) {
    assetsMap[name] = content
    watcher.emit(name)
  }

  getAssets (name) {
    return new Promise((resolve) => {
      const asset = this.assets[name]
      if (asset) {
        return resolve(asset)
      }
      return watcher.once(name, () => {
        const asset = this.assets[name]
        return asset && resolve(asset)
      })
    })
  }

  applyLegacy (compiler) {
    const ID = 'nuxt-legacy-bundle'
    compiler.hooks.compilation.tap(ID, (compilation) => {
      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tap(ID, (data) => {
        // get stats, write to disk
        this.assets = {
          name: data.plugin.options.filename,
          content: data.bodyTags
        }
        return data
      })
    })
  }

  applyModern (compiler) {
    const ID = 'nuxt-modern-bundle'
    compiler.hooks.compilation.tap(ID, (compilation) => {
      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tapPromise(ID, async (data) => {
        // use <script type="module"> for modern assets
        data.bodyTags.forEach((tag) => {
          if (tag.tagName === 'script' && tag.attributes) {
            tag.attributes.type = 'module'
          }
        })

        // use <link rel="modulepreload"> instead of <link rel="preload">
        // for modern assets
        data.headTags.forEach((tag) => {
          if (tag.tagName === 'link' &&
              tag.attributes.rel === 'preload' &&
              tag.attributes.as === 'script') {
            tag.attributes.rel = 'modulepreload'
          }
        })

        // inject links for legacy assets as <script nomodule>
        const fileName = data.plugin.options.filename
        const legacyAssets = (await this.getAssets(fileName))
          .filter(a => a.tagName === 'script' && a.attributes)

        for (const a of legacyAssets) {
          a.attributes.nomodule = true
          data.bodyTags.push(a)
        }

        if (this.noUnsafeInline) {
          // inject the fix as an external script
          const safariFixFilename = 'safari-nomodule-fix.js'
          const safariFixPath = legacyAssets[0].attributes.src
            .split('/')
            .slice(0, -1)
            .concat([safariFixFilename])
            .join('/')

          compilation.assets[safariFixFilename] = {
            source: () => Buffer.from(safariNoModuleFix),
            size: () => Buffer.byteLength(safariNoModuleFix)
          }
          data.bodyTags.push({
            tagName: 'script',
            closeTag: true,
            attributes: {
              src: safariFixPath
            }
          })
        } else {
          // inject Safari 10 nomodule fix
          data.bodyTags.push({
            tagName: 'script',
            closeTag: true,
            innerHTML: safariNoModuleFix
          })
        }

        delete assetsMap[fileName]

        return data
      })
    })
  }
}
