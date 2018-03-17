const { each } = require('lodash')
const webpack = require('webpack')
// const VueSSRClientPlugin = require('vue-server-renderer/client-plugin')
const VueSSRClientPlugin = require('./plugins/vue/client')
const HTMLPlugin = require('html-webpack-plugin')
const FriendlyErrorsWebpackPlugin = require('@nuxtjs/friendly-errors-webpack-plugin')
const StylishPlugin = require('webpack-stylish')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
const { resolve } = require('path')
const Debug = require('debug')
const base = require('./base.config.js')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

const debug = Debug('nuxt:build')
debug.color = 2 // Force green color

/*
|--------------------------------------------------------------------------
| Webpack Client Config
|--------------------------------------------------------------------------
*/
module.exports = function webpackClientConfig() {
  const config = base.call(this, { name: 'client', isServer: false })

  // Entry points
  config.entry = resolve(this.options.buildDir, 'client.js')

  // Env object defined in nuxt.config.js
  let env = {}
  each(this.options.env, (value, key) => {
    env['process.env.' + key] =
      ['boolean', 'number'].indexOf(typeof value) !== -1
        ? value
        : JSON.stringify(value)
  })

  // Generate output HTML for SPA
  config.plugins.push(
    new HTMLPlugin({
      filename: 'index.spa.html',
      template: this.options.appTemplatePath,
      inject: true,
      chunksSortMode: 'dependency'
    })
  )

  // Generate output HTML for SSR
  if (this.options.build.ssr) {
    config.plugins.push(
      new HTMLPlugin({
        filename: 'index.ssr.html',
        template: this.options.appTemplatePath,
        inject: false // Resources will be injected using bundleRenderer
      })
    )
  }

  // Generate vue-ssr-client-manifest
  config.plugins.push(
    new VueSSRClientPlugin({
      filename: 'vue-ssr-client-manifest.json'
    })
  )

  // Define Env
  config.plugins.push(
    new webpack.DefinePlugin(
      Object.assign(env, {
        'process.env.VUE_ENV': JSON.stringify('client'),
        'process.mode': JSON.stringify(this.options.mode),
        'process.browser': true,
        'process.client': true,
        'process.server': false,
        'process.static': this.isStatic
      })
    )
  )

  const shouldClearConsole =
    this.options.build.stats !== false &&
    this.options.build.stats !== 'errors-only'

  // Add friendly error plugin
  config.plugins.push(
    new FriendlyErrorsWebpackPlugin({ clearConsole: shouldClearConsole })
  )

  // Optimization
  config.optimization.splitChunks = {
    chunks: 'all',
    // TODO: remove spa after https://github.com/jantimon/html-webpack-plugin/issues/878 solved
    name: this.options.dev, // || this.options.mode === 'spa',

    // Explicit cache groups
    cacheGroups: {
      // Vue.js core modules
      vue: {
        test: /node_modules\/(vue|vue-loader|vue-router|vuex|vue-meta)\//,
        chunks: 'initial',
        name: 'vue',
        priority: 10,
        enforce: true
      },
      // Common modules which are usually included in projects
      common: {
        test: /node_modules\/(core-js|babel-runtime|lodash|es6-promise|moment|axios|webpack|setimediate|timers-browserify|process)\//,
        chunks: 'initial',
        name: 'common',
        priority: 9
      },
      // Generated templates
      main: {
        test: /\.nuxt\//,
        chunks: 'initial',
        name: 'main',
        priority: 8
      },
      // Other vendors inside node_modules
      vendor: {
        test: /node_modules\//,
        chunks: 'initial',
        name: 'vendor',
        priority: 8
      }
    }
  }

  // Create additional runtime chunk for cache boosting
  config.optimization.runtimeChunk = true

  // CSS extraction
  const extractCSS = this.options.build.extractCSS
  if (extractCSS) {
    config.plugins.push(new ExtractTextPlugin(Object.assign({
      filename: this.getFileName('css')

      // When using optimization.splitChunks and there are
      // extracted chunks in the commons chunk,
      // allChunks *must* be set to true
      // TODO: For nuxt this makes duplicate css assets!
      // allChunks: true
    },
    typeof extractCSS === 'object' ? extractCSS : {}
    )))
  }

  // --------------------------------------
  // Dev specific config
  // --------------------------------------
  if (this.options.dev) {
    // Add HMR support
    config.entry = [
      // https://github.com/glenjamin/webpack-hot-middleware#config
      `webpack-hot-middleware/client?name=client&reload=true&timeout=30000&path=${
        this.options.router.base
      }/__webpack_hmr`.replace(/\/\//g, '/'),
      config.entry
    ]

    // HMR
    config.plugins.push(new webpack.HotModuleReplacementPlugin())
  }

  // --------------------------------------
  // Production specific config
  // --------------------------------------
  if (!this.options.dev) {
    // Chunks size limit
    // https://webpack.js.org/plugins/aggressive-splitting-plugin/
    if (this.options.build.maxChunkSize) {
      config.plugins.push(
        new webpack.optimize.AggressiveSplittingPlugin({
          minSize: this.options.build.maxChunkSize,
          maxSize: this.options.build.maxChunkSize
        })
      )
    }

    // https://github.com/webpack-contrib/webpack-stylish
    if (!this.options.dev) {
      config.plugins.push(new StylishPlugin())
    }

    // Webpack Bundle Analyzer
    if (this.options.build.analyze) {
      config.plugins.push(
        new BundleAnalyzerPlugin(Object.assign({}, this.options.build.analyze))
      )
    }
  }

  // Extend config
  if (typeof this.options.build.extend === 'function') {
    const isDev = this.options.dev
    const extendedConfig = this.options.build.extend.call(this, config, {
      isDev,
      isClient: true
    })

    // Only overwrite config when something is returned for backwards compatibility
    if (extendedConfig !== undefined) {
      config = extendedConfig
    }
  }

  return config
}
