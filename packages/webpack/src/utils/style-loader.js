import path from 'path'
import ExtractCssChunksPlugin from 'extract-css-chunks-webpack-plugin'

import { wrapArray } from '@nuxt/utils'

import PostcssConfig from './postcss'

export default class StyleLoader {
  constructor(buildContext, { isServer, perfLoader }) {
    this.buildContext = buildContext
    this.isServer = isServer
    this.perfLoader = perfLoader

    if (buildContext.options.build.postcss) {
      this.postcssConfig = new PostcssConfig(buildContext)
    }
  }

  get exportOnlyLocals() {
    return Boolean(this.isServer && this.buildContext.buildOptions.extractCSS)
  }

  normalize(loaders) {
    loaders = wrapArray(loaders)
    return loaders.map(loader => (typeof loader === 'string' ? { loader } : loader))
  }

  styleResource(ext) {
    const extResource = this.buildContext.buildOptions.styleResources[ext]
    // style-resources-loader
    // https://github.com/yenshih/style-resources-loader
    if (!extResource) {
      return
    }
    const patterns = wrapArray(extResource).map(p => path.resolve(this.buildContext.options.rootDir, p))

    return {
      loader: 'style-resources-loader',
      options: Object.assign(
        { patterns },
        this.buildContext.buildOptions.styleResources.options || {}
      )
    }
  }

  postcss() {
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
      loader: 'postcss-loader',
      options: Object.assign({ sourceMap: this.buildContext.buildOptions.cssSourceMap }, config)
    }
  }

  css(options) {
    options.exportOnlyLocals = this.exportOnlyLocals
    const cssLoader = { loader: 'css-loader', options }

    if (options.exportOnlyLocals) {
      return [cssLoader]
    }

    return [this.styleLoader(), cssLoader]
  }

  cssModules(options) {
    return this.css(Object.assign(options, { modules: true }))
  }

  extract() {
    if (this.buildContext.buildOptions.extractCSS) {
      return ExtractCssChunksPlugin.loader
    }
  }

  styleLoader() {
    return this.buildContext.buildOptions.extractCSS() || {
      loader: 'vue-style-loader',
      options: this.buildContext.buildOptions.loaders.vueStyle
    }
  }

  apply(ext, loaders = []) {
    const customLoaders = [].concat(
      this.postcss(),
      this.normalize(loaders),
      this.styleResource(ext)
    ).filter(Boolean)

    this.buildContext.buildOptions.loaders.css.importLoaders = this.buildContext.buildOptions.loaders.cssModules.importLoaders = customLoaders.length

    return [
      // This matches <style module>
      {
        resourceQuery: /module/,
        use: this.perfLoader.css().concat(
          this.cssModules(this.buildContext.buildOptions.loaders.cssModules),
          customLoaders
        )
      },
      // This matches plain <style> or <style scoped>
      {
        use: this.perfLoader.css().concat(
          this.css(this.buildContext.buildOptions.loaders.css),
          customLoaders
        )
      }
    ]
  }
}
