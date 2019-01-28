/*
* This file is based on @vue/cli-service (MIT) ModernModePlugin
* https://github.com/vuejs/vue-cli/blob/dev/packages/@vue/cli-service/lib/webpack/ModernModePlugin.js
*/

import EventEmitter from 'events'

const assetsMap = {}
const watcher = new EventEmitter()

export default class ModernModePlugin {
  constructor({ targetDir, isModernBuild }) {
    this.targetDir = targetDir
    this.isModernBuild = isModernBuild
  }

  apply(compiler) {
    if (!this.isModernBuild) {
      this.applyLegacy(compiler)
    } else {
      this.applyModern(compiler)
    }
  }

  set assets({ name, content }) {
    assetsMap[name] = content
    watcher.emit(name)
  }

  getAssets(name) {
    return assetsMap[name] ||
      new Promise((resolve) => {
        watcher.once(name, () => {
          return assetsMap[name] && resolve(assetsMap[name])
        })
        return assetsMap[name] && resolve(assetsMap[name])
      })
  }

  applyLegacy(compiler) {
    const ID = `nuxt-legacy-bundle`
    compiler.hooks.compilation.tap(ID, (compilation) => {
      // For html-webpack-plugin 4.0
      // HtmlWebpackPlugin.getHooks(compilation).alterAssetTags.tapAsync(ID, async (data, cb) => {
      compilation.hooks.htmlWebpackPluginAlterAssetTags.tapAsync(ID, (data, cb) => {
        // get stats, write to disk
        this.assets = {
          name: data.plugin.options.filename,
          content: data.body
        }

        cb()
      })
    })
  }

  applyModern(compiler) {
    const ID = `nuxt-modern-bundle`
    compiler.hooks.compilation.tap(ID, (compilation) => {
      // For html-webpack-plugin 4.0
      // HtmlWebpackPlugin.getHooks(compilation).alterAssetTags.tapAsync(ID, async (data, cb) => {
      compilation.hooks.htmlWebpackPluginAlterAssetTags.tapAsync(ID, async (data, cb) => {
        // use <script type="module"> for modern assets
        data.body.forEach((tag) => {
          if (tag.tagName === 'script' && tag.attributes) {
            tag.attributes.type = 'module'
          }
        })

        // use <link rel="modulepreload"> instead of <link rel="preload">
        // for modern assets
        data.head.forEach((tag) => {
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
          a.attributes.nomodule = ''
          data.body.push(a)
        }

        delete assetsMap[fileName]
        cb()
      })

      compilation.hooks.htmlWebpackPluginAfterHtmlProcessing.tap(ID, (data) => {
        data.html = data.html.replace(/\snomodule="">/g, ' nomodule>')

        // inject Safari 10 nomodule fix
        data.html = data.html.replace(
          /(<\/body\s*>)/i,
          match => `<script>${ModernModePlugin.safariFix}</script>${match}`
        )
      })
    })
  }
}

// https://gist.github.com/samthor/64b114e4a4f539915a95b91ffd340acc
ModernModePlugin.safariFix = `!function(){var e=document,t=e.createElement("script");if(!("noModule"in t)&&"onbeforeload"in t){var n=!1;e.addEventListener("beforeload",function(e){if(e.target===t)n=!0;else if(!e.target.hasAttribute("nomodule")||!n)return;e.preventDefault()},!0),t.type="module",t.src=".",e.head.appendChild(t),t.remove()}}();`
