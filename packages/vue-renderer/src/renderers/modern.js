import invert from 'lodash/invert'
import { isUrl, urlJoin, safariNoModuleFix } from '@nuxt/utils'
import SSRRenderer from './ssr'

export default class ModernRenderer extends SSRRenderer {
  constructor (serverContext) {
    super(serverContext)

    const { build: { publicPath }, router: { base } } = this.options
    this.publicPath = isUrl(publicPath) ? publicPath : urlJoin(base, publicPath)
  }

  get assetsMapping () {
    if (this._assetsMapping) {
      return this._assetsMapping
    }

    const { clientManifest, modernManifest } = this.serverContext.resources
    const legacyAssets = clientManifest.assetsMapping
    const modernAssets = invert(modernManifest.assetsMapping)
    const mapping = {}

    for (const legacyJsFile in legacyAssets) {
      const chunkNamesHash = legacyAssets[legacyJsFile]
      mapping[legacyJsFile] = modernAssets[chunkNamesHash]
    }
    delete clientManifest.assetsMapping
    delete modernManifest.assetsMapping
    this._assetsMapping = mapping

    return mapping
  }

  get isServerMode () {
    return this.options.modern === 'server'
  }

  get rendererOptions () {
    const rendererOptions = super.rendererOptions
    if (this.isServerMode) {
      rendererOptions.clientManifest = this.serverContext.resources.modernManifest
    }
    return rendererOptions
  }

  renderScripts (renderContext) {
    const scripts = super.renderScripts(renderContext)

    if (this.isServerMode) {
      return scripts
    }

    const scriptPattern = /<script[^>]*?src="([^"]*?)"[^>]*?>[^<]*?<\/script>/g

    const modernScripts = scripts.replace(scriptPattern, (scriptTag, jsFile) => {
      const legacyJsFile = jsFile.replace(this.publicPath, '')
      const modernJsFile = this.assetsMapping[legacyJsFile]
      const { build: { crossorigin } } = this.options
      const cors = `${crossorigin ? ` crossorigin="${crossorigin}"` : ''}`
      const moduleTag = modernJsFile
        ? scriptTag
          .replace('<script', `<script type="module"${cors}`)
          .replace(legacyJsFile, modernJsFile)
        : ''
      const noModuleTag = scriptTag.replace('<script', `<script nomodule${cors}`)

      return noModuleTag + moduleTag
    })

    const safariNoModuleFixScript = `<script>${safariNoModuleFix}</script>`

    return safariNoModuleFixScript + modernScripts
  }

  getModernFiles (legacyFiles = []) {
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

  getPreloadFiles (renderContext) {
    const preloadFiles = super.getPreloadFiles(renderContext)
    // In eligible server modern mode, preloadFiles are modern bundles from modern renderer
    return this.isServerMode ? preloadFiles : this.getModernFiles(preloadFiles)
  }

  renderResourceHints (renderContext) {
    const resourceHints = super.renderResourceHints(renderContext)
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
      const { crossorigin } = this.options.build
      const cors = `${crossorigin ? ` crossorigin="${crossorigin}"` : ''}`
      return linkTag.replace('rel="preload"', `rel="modulepreload"${cors}`).replace(legacyJsFile, modernJsFile)
    })
  }

  render (renderContext) {
    if (this.isServerMode) {
      renderContext.res.setHeader('Vary', 'User-Agent')
    }
    return super.render(renderContext)
  }
}
