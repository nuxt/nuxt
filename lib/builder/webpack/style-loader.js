const ExtractTextPlugin = require('extract-text-webpack-plugin')
const { join } = require('path')
const postcssConfig = require('./postcss')

module.exports = function styleLoader(ext, loaders = [], isVueLoader = false) {
  const sourceMap = Boolean(this.options.build.cssSourceMap)

  // Normalize loaders
  loaders = (Array.isArray(loaders) ? loaders : [loaders]).map(loader =>
    Object.assign(
      { options: { sourceMap } },
      typeof loader === 'string' ? { loader } : loader
    )
  )

  // Prepare vue-style-loader
  // https://github.com/vuejs/vue-style-loader
  const vueStyleLoader = {
    loader: 'vue-style-loader',
    options: { sourceMap }
  }

  // -- Configure additional loaders --

  // style-resources-loader
  // https://github.com/yenshih/style-resources-loader
  if (this.options.build.styleResources[ext]) {
    const patterns = Array.isArray(this.options.build.styleResources[ext])
      ? this.options.build.styleResources[ext]
      : [this.options.build.styleResources[ext]]
    const options = Object.assign(
      {},
      this.options.build.styleResources.options || {},
      { patterns }
    )

    loaders.push({
      loader: 'style-resources-loader',
      options
    })
  }

  // postcss-loader
  // vue-loader already provides it's own
  // https://github.com/postcss/postcss-loader
  if (!isVueLoader) {
    const _postcssConfig = postcssConfig.call(this)

    if (_postcssConfig) {
      loaders.unshift({
        loader: 'postcss-loader',
        options: Object.assign({ sourceMap }, _postcssConfig)
      })
    }
  }

  // css-loader
  // https://github.com/webpack-contrib/css-loader
  const cssLoaderAlias = {}
  cssLoaderAlias[`/${this.options.dir.assets}`] = join(this.options.srcDir, this.options.dir.assets)
  cssLoaderAlias[`/${this.options.dir.static}`] = join(this.options.srcDir, this.options.dir.static)

  loaders.unshift({
    loader: 'css-loader',
    options: {
      sourceMap,
      minimize: !this.options.dev,
      importLoaders: loaders.length, // Important!
      alias: cssLoaderAlias
    }
  })

  // -- With extractCSS --
  // TODO: Temporary disabled in dev mode for fixing source maps
  // (We need `source-map` devtool for *.css modules)
  if (this.options.build.extractCSS && !this.options.dev) {
    // ExtractTextPlugin
    // https://github.com/webpack-contrib/extract-text-webpack-plugin
    const extractLoader = ExtractTextPlugin.extract({
      use: loaders,
      fallback: vueStyleLoader
    })

    // css-hot-loader
    // https://github.com/shepherdwind/css-hot-loader
    const hotLoader = {
      loader: 'css-hot-loader',
      options: { sourceMap }
    }

    return this.options.dev ? [hotLoader].concat(extractLoader) : extractLoader
  }

  // -- Without extractCSS --
  return [vueStyleLoader].concat(loaders)
}
