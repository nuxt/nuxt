import path from 'path'

import MiniCssExtractPlugin from 'mini-css-extract-plugin'

import postcssConfig from './postcss'

export default ({ isServer }) => {
  return function styleLoader(ext, loaders = []) {
    const sourceMap = Boolean(this.options.build.cssSourceMap)

    // Normalize loaders
    loaders = (Array.isArray(loaders) ? loaders : [loaders]).map(loader =>
      Object.assign(
        { options: { sourceMap } },
        typeof loader === 'string' ? { loader } : loader
      )
    )

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
    // https://github.com/postcss/postcss-loader
    const _postcssConfig = postcssConfig.call(this)

    if (_postcssConfig) {
      loaders.unshift({
        loader: 'postcss-loader',
        options: Object.assign({ sourceMap }, _postcssConfig)
      })
    }

    // css-loader
    // https://github.com/webpack-contrib/css-loader
    const cssLoaderAlias = {}
    cssLoaderAlias[`/${this.options.dir.assets}`] = path.join(this.options.srcDir, this.options.dir.assets)
    cssLoaderAlias[`/${this.options.dir.static}`] = path.join(this.options.srcDir, this.options.dir.static)

    loaders.unshift({
      loader: 'css-loader',
      options: {
        sourceMap,
        minimize: !this.options.dev,
        importLoaders: loaders.length, // Important!
        alias: cssLoaderAlias
      }
    })

    // Prepare vue-style-loader
    // https://github.com/vuejs/vue-style-loader
    loaders.unshift({
      loader: 'vue-style-loader',
      options: { sourceMap }
    })

    // -- With extractCSS --
    if (this.options.build.extractCSS) {
      if (!isServer) {
        loaders.unshift(MiniCssExtractPlugin.loader)
        if (this.options.dev) {
          // css-hot-loader
          // https://github.com/shepherdwind/css-hot-loader
          loaders.unshift({
            loader: 'css-hot-loader',
            options: { sourceMap }
          })
        }
      }
    }
    return loaders
  }
}
