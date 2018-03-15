const { each } = require('lodash')
const webpack = require('webpack')
const VueSSRClientPlugin = require('vue-server-renderer/client-plugin')
const HTMLPlugin = require('html-webpack-plugin')
const FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin')
const StylishPlugin = require('webpack-stylish')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
const { resolve } = require('path')
const Debug = require('debug')
const base = require('./base.config.js')

const debug = Debug('nuxt:build')
debug.color = 2 // Force green color

module.exports = function webpackClientConfig() {
  let config = base.call(this, { name: 'client', isServer: false })

  // Entry points
  config.entry.app = resolve(this.options.buildDir, 'client.js')

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
  config.optimization = {
    splitChunks: {
      chunks: 'all',
      // TODO: remove spa after https://github.com/jantimon/html-webpack-plugin/issues/878 solved
      name: this.options.dev || this.options.mode === 'spa'
    }
  }

  // --------------------------------------
  // Dev specific config
  // --------------------------------------
  if (this.options.dev) {
    // Add HMR support
    config.entry.app = [
      // https://github.com/glenjamin/webpack-hot-middleware#config
      `webpack-hot-middleware/client?name=client&reload=true&timeout=30000&path=${
        this.options.router.base
      }/__webpack_hmr`.replace(/\/\//g, '/'),
      config.entry.app
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
