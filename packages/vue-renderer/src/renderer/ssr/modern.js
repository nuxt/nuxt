import invert from 'lodash/invert'
import { isUrl, urlJoin } from '@nuxt/utils'

import SSRRenderer from './index'

export default class ModernRenderer extends SSRRenderer {
  constructor(context) {
    super(context)

    const { build: { publicPath }, router: { base } } = this.context.options
    this.publicPath = isUrl(publicPath) ? publicPath : urlJoin(base, publicPath)
  }

  get assetsMapping() {
    if (this._assetsMapping) {
      return this._assetsMapping
    }

    const legacyAssets = this.context.resources.clientManifest.assetsMapping
    const modernAssets = invert(this.context.resources.modernManifest.assetsMapping)
    const mapping = {}

    for (const legacyJsFile in legacyAssets) {
      const chunkNamesHash = legacyAssets[legacyJsFile]
      mapping[legacyJsFile] = modernAssets[chunkNamesHash]
    }
    delete this.context.resources.clientManifest.assetsMapping
    delete this.context.resources.modernManifest.assetsMapping
    this._assetsMapping = mapping

    return mapping
  }

  get isServerMode() {
    return this.context.options.modern === 'server'
  }

  get rendererOptions() {
    const rendererOptions = super.rendererOptions
    if (this.isServerMode) {
      rendererOptions.clientManifest = this.context.resources.modernManifest
    }
    return rendererOptions
  }

  renderScripts(context) {
    const scripts = super.renderScripts(context)

    if (this.isServerMode) {
      return scripts
    }

    const scriptPattern = /<script[^>]*?src="([^"]*?)"[^>]*?>[^<]*?<\/script>/g

    return scripts.replace(scriptPattern, (scriptTag, jsFile) => {
      const legacyJsFile = jsFile.replace(this.publicPath, '')
      const modernJsFile = this.assetsMapping[legacyJsFile]
      const { build: { crossorigin } } = this.context.options
      const cors = `${crossorigin ? ` crossorigin="${crossorigin}"` : ''}`
      const moduleTag = modernJsFile
        ? scriptTag
          .replace('<script', `<script type="module"${cors}`)
          .replace(legacyJsFile, modernJsFile)
        : ''
      const noModuleTag = scriptTag.replace('<script', `<script nomodule${cors}`)

      return noModuleTag + moduleTag
    })
  }

  getModernFiles(legacyFiles = []) {
    const modernFiles = []

    for (const legacyJsFile of legacyFiles) {
      const modernFile = { ...legacyJsFile, modern: true }
      if (modernFile.asType === 'script') {
        const file = this.assetsMapping[legacyJsFile.file]
        modernFile.file = file
        modernFile.fileWithoutQuery = file.replace(/\?.*/, '')
      }
      modernFiles.push(modernFile)
    }

    return modernFiles
  }

  getPreloadFiles(context) {
    const preloadFiles = super.getPreloadFiles(context)
    // In eligible server modern mode, preloadFiles are modern bundles from modern renderer
    return this.isServerMode ? preloadFiles : this.getModernFiles(preloadFiles)
  }

  renderResourceHints(context) {
    const resourceHints = super.renderResourceHints(context)
    if (this.isServerMode) {
      return resourceHints
    }

    const linkPattern = /<link[^>]*?href="([^"]*?)"[^>]*?as="script"[^>]*?>/g

    return resourceHints.replace(linkPattern, (linkTag, jsFile) => {
      const legacyJsFile = jsFile.replace(this.publicPath, '')
      const modernJsFile = this.assetsMapping[legacyJsFile]
      if (!modernJsFile) {
        return ''
      }
      const { crossorigin } = this.context.options.build
      const cors = `${crossorigin ? ` crossorigin="${crossorigin}"` : ''}`
      return linkTag.replace('rel="preload"', `rel="modulepreload"${cors}`).replace(legacyJsFile, modernJsFile)
    })
  }
}
