import path from 'path'
import ExtractCssChunksPlugin from 'extract-css-chunks-webpack-plugin'

import { wrapArray } from '@nuxt/utils'

import PostcssConfig from './postcss'

export default class StyleLoader {
  constructor(context, { isServer, perfLoader }) {
    this.context = context
    this.isServer = isServer
    this.perfLoader = perfLoader

    if (context.options.build.postcss) {
      this.postcssConfig = new PostcssConfig(context)
    }
  }

  get buildOpts() {
    return this.context.options.build
  }

  get exportOnlyLocals() {
    return Boolean(this.isServer && this.buildOpts.extractCSStCSS)
  }

  normalize(loaders) {
    loaders = wrapArray(loaders)
    return loaders.map(loader => (typeof loader === 'string' ? { loader } : loader))
  }

  styleResource(ext) {
    const extResource = this.buildOpts.styleResources[ext]
    // style-resources-loader
    // https://github.com/yenshih/style-resources-loader
    if (!extResource) {
      return
    }
    const patterns = wrapArray(extResource).map(p => path.resolve(this.context.options.rootDir, p))

    return {
      loader: 'style-resources-loader',
      options: Object.assign(
        { patterns },
        this.buildOpts.styleResources.options || {}
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
      options: Object.assign({ sourceMap: this.buildOpts.cssSourceMap }, config)
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
    if (this.buildOpts.extractCSStCSS) {
      return ExtractCssChunksPlugin.loader
    }
  }

  styleLoader() {
    return this.buildOpts.extractCSSt() || {
      loader: 'vue-style-loader',
      options: this.buildOpts.loaders.vueStyle
    }
  }

  apply(ext, loaders = []) {
    const customLoaders = [].concat(
      this.postcss(),
      this.normalize(loaders),
      this.styleResource(ext)
    ).filter(Boolean)

    this.buildOpts.loaders.css.importLoaders = this.buildOpts.loaders.cssModules.importLoaders = customLoaders.length

    return [
      // This matches <style module>
      {
        resourceQuery: /module/,
        use: this.perfLoader.css().concat(
          this.cssModules(this.buildOpts.loaders.cssModules),
          customLoaders
        )
      },
      // This matches plain <style> or <style scoped>
      {
        use: this.perfLoader.css().concat(
          this.css(this.buildOpts.loaders.css),
          customLoaders
        )
      }
    ]
  }
}
