import path from 'path'

import MiniCssExtractPlugin from 'mini-css-extract-plugin'

import PostcssConfig from './postcss'

export default class StyleLoader {
  constructor(options, nuxt, { isServer }) {
    this.isServer = isServer
    this.dev = options.dev
    this.srcDir = options.srcDir
    this.assetsDir = options.dir.assets
    this.staticDir = options.dir.static
    this.extractCSS = options.build.extractCSS
    this.resources = options.build.styleResources
    this.sourceMap = Boolean(options.build.cssSourceMap)

    if (options.build.postcss) {
      this.postcssConfig = new PostcssConfig(options, nuxt)
    }
  }

  normalize(loaders) {
    loaders = Array.isArray(loaders) ? loaders : [loaders]
    return loaders.map(loader => Object.assign(
      { options: { sourceMap: this.sourceMap } },
      typeof loader === 'string' ? { loader } : loader
    ))
  }

  styleResource(ext, loaders) {
    const extResource = this.resources[ext]
    // style-resources-loader
    // https://github.com/yenshih/style-resources-loader
    if (extResource) {
      const patterns = Array.isArray(extResource)
        ? extResource
        : [extResource]

      loaders.push({
        loader: 'style-resources-loader',
        options: Object.assign(
          { patterns },
          this.resources.options || {}
        )
      })
    }
  }

  postcss(loaders) {
    // postcss-loader
    // https://github.com/postcss/postcss-loader
    if (this.postcssConfig) {
      const config = this.postcssConfig.config()
      if (config) {
        loaders.unshift({
          loader: 'postcss-loader',
          options: Object.assign({ sourceMap: this.sourceMap }, config)
        })
      }
    }
  }

  css(loaders) {
    // css-loader
    // https://github.com/webpack-contrib/css-loader
    const cssLoaderAlias = {
      [`/${this.assetsDir}`]: path.join(this.srcDir, this.assetsDir),
      [`/${this.staticDir}`]: path.join(this.srcDir, this.staticDir)
    }

    loaders.unshift({
      loader: 'css-loader',
      options: {
        sourceMap: this.sourceMap,
        minimize: !this.dev,
        importLoaders: loaders.length, // Important!
        alias: cssLoaderAlias
      }
    })
  }

  extract(loaders) {
    if (this.extractCSS) {
      loaders.unshift(MiniCssExtractPlugin.loader)
      if (this.dev) {
        // css-hot-loader
        // https://github.com/shepherdwind/css-hot-loader
        loaders.unshift({
          loader: 'css-hot-loader',
          options: { sourceMap: this.sourceMap }
        })
      }
      return true
    }
  }

  vueStyle(loaders) {
    // https://github.com/vuejs/vue-style-loader
    loaders.unshift({
      loader: 'vue-style-loader',
      options: { sourceMap: this.sourceMap }
    })
  }

  apply(ext, loaders = []) {
    // Normalize loaders
    loaders = this.normalize(loaders)

    // -- Configure additional loaders --
    this.styleResource(ext, loaders)
    this.postcss(loaders)
    this.css(loaders)
    if (!this.extract(loaders)) {
      this.vueStyle(loaders)
    }

    return loaders
  }
}
