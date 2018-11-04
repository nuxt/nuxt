/*
** This plugin is inspired by @vue/cli-service ModernModePlugin
** https://github.com/vuejs/vue-cli/blob/dev/packages/@vue/cli-service/lib/webpack/ModernModePlugin.js
*/
import path from 'path'
import fs from 'fs-extra'
import chokidar from 'chokidar'

// https://gist.github.com/samthor/64b114e4a4f539915a95b91ffd340acc
const safariFix = `!function(){var e=document,t=e.createElement("script");if(!("noModule"in t)&&"onbeforeload"in t){var n=!1;e.addEventListener("beforeload",function(e){if(e.target===t)n=!0;else if(!e.target.hasAttribute("nomodule")||!n)return;e.preventDefault()},!0),t.type="module",t.src=".",e.head.appendChild(t),t.remove()}}();`

class ModernModePlugin {
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

  getAssetsMappingFile(fileName) {
    const htmlName = path.basename(fileName)
    // Watch out for output files in sub directories
    const htmlPath = path.dirname(fileName)
    return path.join(this.targetDir, htmlPath, `legacy-assets-${htmlName}.json`)
  }

  async generateAssetsMapping(fileName, content) {
    const assetsMappingFile = this.getAssetsMappingFile(fileName)
    await fs.outputJson(assetsMappingFile, content)
  }

  async waitFileCreated(fileName) {
    if (fs.pathExistsSync(fileName)) return
    const watcher = chokidar.watch(path.dirname(fileName))
    await new Promise((resolve) => {
      watcher
        .on('add', (filePath) => {
          if (fileName === filePath || fs.pathExistsSync(fileName)) {
            resolve()
          }
        })
        .on('ready', () => {
          if (fs.pathExistsSync(fileName)) {
            resolve()
          }
        })
    })
    watcher.close()
  }

  applyLegacy(compiler) {
    const ID = `nuxt-legacy-bundle`
    compiler.hooks.compilation.tap(ID, (compilation) => {
      // For html-webpack-plugin 4.0
      // HtmlWebpackPlugin.getHooks(compilation).alterAssetTags.tapAsync(ID, async (data, cb) => {
      compilation.hooks.htmlWebpackPluginAlterAssetTags.tapAsync(ID, async (data, cb) => {
        // get stats, write to disk
        await this.generateAssetsMapping(data.plugin.options.filename, data.body)
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

        // inject Safari 10 nomodule fix
        data.body.push({
          tagName: 'script',
          closeTag: true,
          innerHTML: safariFix
        })

        const assetsMappingFile = this.getAssetsMappingFile(data.plugin.options.filename)
        await this.waitFileCreated(assetsMappingFile)

        // inject links for legacy assets as <script nomodule>
        const legacyAssets = JSON.parse(await fs.readFile(assetsMappingFile, 'utf-8'))
          .filter(a => a.tagName === 'script' && a.attributes)
        legacyAssets.forEach(a => (a.attributes.nomodule = ''))
        data.body.push(...legacyAssets)
        await fs.remove(assetsMappingFile)
        cb()
      })

      compilation.hooks.htmlWebpackPluginAfterHtmlProcessing.tap(ID, (data) => {
        data.html = data.html.replace(/\snomodule="">/g, ' nomodule>')
      })
    })
  }
}

ModernModePlugin.safariFix = safariFix

export default ModernModePlugin
