import path from 'path'
import ExtractCssChunksPlugin from 'extract-css-chunks-webpack-plugin'

import { wrapArray } from '@nuxt/utils'

import PostcssConfig from './postcss'

export default class StyleLoader {
  constructor(options, nuxt, { isServer, perfLoader }) {
    this.isServer = isServer
    this.perfLoader = perfLoader
    this.rootDir = options.rootDir
    this.loaders = {
      vueStyle: options.build.loaders.vueStyle,
      css: options.build.loaders.css,
      cssModules: options.build.loaders.cssModules
    }
    this.extractCSS = options.build.extractCSS
    this.resources = options.build.styleResources
    this.sourceMap = Boolean(options.build.cssSourceMap)

    if (options.build.postcss) {
      this.postcssConfig = new PostcssConfig(options, nuxt)
    }
  }

  get exportOnlyLocals() {
    return Boolean(this.isServer && this.extractCSS)
  }

  normalize(loaders) {
    loaders = wrapArray(loaders)
    return loaders.map(loader => (typeof loader === 'string' ? { loader } : loader))
  }

  styleResource(ext) {
    const extResource = this.resources[ext]
    // style-resources-loader
    // https://github.com/yenshih/style-resources-loader
    if (extResource) {
      const patterns = wrapArray(extResource).map(p => path.resolve(this.rootDir, p))

      return {
        loader: 'style-resources-loader',
        options: Object.assign(
          { patterns },
          this.resources.options || {}
        )
      }
    }
  }

  postcss() {
    // postcss-loader
    // https://github.com/postcss/postcss-loader
    if (this.postcssConfig) {
      const config = this.postcssConfig.config()
      if (config) {
        return {
          loader: 'postcss-loader',
          options: Object.assign({ sourceMap: this.sourceMap }, config)
        }
      }
    }
  }

  css(options) {
    options.exportOnlyLocals = this.exportOnlyLocals
    return [
      ...options.exportOnlyLocals ? [] : [this.styleLoader()],
      { loader: 'css-loader', options }
    ]
  }

  cssModules(options) {
    return this.css(Object.assign(options, { modules: true }))
  }

  extract() {
    if (this.extractCSS) {
      return ExtractCssChunksPlugin.loader
    }
  }

  styleLoader() {
    return this.extract() || {
      loader: 'vue-style-loader',
      options: this.loaders.vueStyle
    }
  }

  apply(ext, loaders = []) {
    const customLoaders = [].concat(
      this.postcss(),
      this.normalize(loaders),
      this.styleResource(ext)
    ).filter(Boolean)

    this.loaders.css.importLoaders = this.loaders.cssModules.importLoaders = customLoaders.length

    return [
      // This matches <style module>
      {
        resourceQuery: /module/,
        use: this.perfLoader.css().concat(
          this.cssModules(this.loaders.cssModules),
          customLoaders
        )
      },
      // This matches plain <style> or <style scoped>
      {
        use: this.perfLoader.css().concat(
          this.css(this.loaders.css),
          customLoaders
        )
      }
    ]
  }
}
