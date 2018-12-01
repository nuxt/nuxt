import path from 'path'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'

import { wrapArray } from '@nuxt/common'

import PostcssConfig from './postcss'

export default class StyleLoader {
  constructor(options, nuxt, { isServer, perfLoader }) {
    this.isServer = isServer
    this.perfLoader = perfLoader
    this.dev = options.dev
    this.srcDir = options.srcDir
    this.assetsDir = options.dir.assets
    this.staticDir = options.dir.static
    this.rootDir = options.rootDir
    this.loaders = {
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
    return {
      loader: (this.isServer && this.extractCSS) ? 'css-loader/locals' : 'css-loader',
      options
    }
  }

  cssModules(options) {
    options.modules = true
    return {
      loader: 'css-loader',
      options
    }
  }

  extract() {
    if (this.extractCSS && !this.isServer) {
      return MiniCssExtractPlugin.loader
    }
  }

  vueStyle() {
    // https://github.com/vuejs/vue-style-loader
    return {
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

    const styleLoader = this.extract() || this.vueStyle()

    return [
      // This matches <style module>
      {
        resourceQuery: /module/,
        use: this.perfLoader.css().concat(
          styleLoader,
          this.cssModules(this.loaders.cssModules),
          customLoaders
        )
      },
      // This matches plain <style> or <style scoped>
      {
        use: this.perfLoader.css().concat(
          styleLoader,
          this.css(this.loaders.css),
          customLoaders
        )
      }
    ]
  }
}
