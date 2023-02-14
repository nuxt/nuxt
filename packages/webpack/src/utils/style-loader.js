import path from 'path'
import ExtractCssChunksPlugin from 'extract-css-chunks-webpack-plugin'

import { wrapArray } from '@nuxt/utils'

import PostcssConfig from './postcss'

export default class StyleLoader {
  constructor (buildContext, { isServer, perfLoader, resolveModule }) {
    this.buildContext = buildContext
    this.isServer = isServer
    this.perfLoader = perfLoader
    this.resolveModule = resolveModule

    const { postcss } = buildContext.options.build
    if (postcss) {
      this.postcssConfig = new PostcssConfig(buildContext)
    }
  }

  get extractCSS () {
    return this.buildContext.buildOptions.extractCSS
  }

  get exportOnlyLocals () {
    return Boolean(this.isServer && this.extractCSS)
  }

  isUrlResolvingEnabled (url, resourcePath) {
    // Ignore absolute URLs, it will be handled by serve-static.
    return !url.startsWith('/')
  }

  normalize (loaders) {
    loaders = wrapArray(loaders)
    return loaders.map(loader => (typeof loader === 'string' ? { loader } : loader))
  }

  styleResource (ext) {
    const { buildOptions: { styleResources }, options: { rootDir } } = this.buildContext
    const extResource = styleResources[ext]
    // style-resources-loader
    // https://github.com/yenshih/style-resources-loader
    if (!extResource) {
      return
    }
    const patterns = wrapArray(extResource).map(p => path.resolve(rootDir, p))

    return {
      loader: this.resolveModule('style-resources-loader'),
      options: Object.assign(
        { patterns },
        styleResources.options || {}
      )
    }
  }

  postcss () {
    // postcss-loader
    // https://github.com/postcss/postcss-loader
    if (!this.postcssConfig) {
      return
    }

    const config = this.postcssConfig.config()

    if (!config) {
      return
    }

    return {
      loader: this.resolveModule('postcss-loader'),
      options: Object.assign({ sourceMap: this.buildContext.buildOptions.cssSourceMap }, config)
    }
  }

  css (options) {
    const cssLoader = { loader: this.resolveModule('css-loader'), options }

    if (!options.url) {
      options.url = this.isUrlResolvingEnabled
    }

    if (this.exportOnlyLocals) {
      options.modules = {
        ...options.modules,
        exportOnlyLocals: true
      }
      return [cssLoader]
    }

    return [this.styleLoader(), cssLoader]
  }

  cssModules (options) {
    return this.css(options)
  }

  extract () {
    if (this.extractCSS) {
      const isDev = this.buildContext.options.dev
      return {
        loader: ExtractCssChunksPlugin.loader,
        options: {
          // TODO: https://github.com/faceyspacey/extract-css-chunks-webpack-plugin/issues/132
          // https://github.com/faceyspacey/extract-css-chunks-webpack-plugin/issues/161#issuecomment-500162574
          reloadAll: isDev,
          hmr: isDev
        }
      }
    }
  }

  styleLoader () {
    return this.extract() || {
      loader: this.resolveModule('vue-style-loader'),
      options: this.buildContext.buildOptions.loaders.vueStyle
    }
  }

  apply (ext, loaders = []) {
    const { css, cssModules } = this.buildContext.buildOptions.loaders

    const customLoaders = [].concat(
      this.postcss(),
      this.normalize(loaders),
      this.styleResource(ext)
    ).filter(Boolean)

    css.importLoaders = cssModules.importLoaders = customLoaders.length

    return [
      // This matches <style module>
      {
        resourceQuery: /module/,
        use: this.perfLoader.css().concat(
          this.cssModules(cssModules),
          customLoaders
        )
      },
      // This matches plain <style> or <style scoped>
      {
        use: this.perfLoader.css().concat(
          this.css(css),
          customLoaders
        )
      }
    ]
  }
}
