import path from 'path'

import _ from 'lodash'
import webpack from 'webpack'

import HTMLPlugin from 'html-webpack-plugin'
import StylishPlugin from 'webpack-stylish'
import BundleAnalyzer from 'webpack-bundle-analyzer'
import HtmlWebpackInlineSourcePlugin from 'html-webpack-inline-source-plugin'

import Debug from 'debug'
import base from './base.config'

// import VueSSRClientPlugin from 'vue-server-renderer/client-plugin'
import VueSSRClientPlugin from './plugins/vue/client'

const debug = Debug('nuxt:build')
debug.color = 2 // Force green color

/*
|--------------------------------------------------------------------------
| Webpack Client Config
|--------------------------------------------------------------------------
*/
export default function webpackClientConfig() {
  let config = base.call(this, { name: 'client', isServer: false })

  // Entry points
  config.entry = path.resolve(this.options.buildDir, 'client.js')

  // Env object defined in nuxt.config.js
  let env = {}
  _.each(this.options.env, (value, key) => {
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
      inlineSource: /runtime.*\.js$/,
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

  // Enhances html-webpack-plugin functionality by adding the inlineSource option.
  // https://github.com/DustinJackson/html-webpack-inline-source-plugin
  config.plugins.push(new HtmlWebpackInlineSourcePlugin())

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

  // -- Optimization --
  config.optimization = this.options.build.optimization

  // TODO: remove spa check after https://github.com/jantimon/html-webpack-plugin/issues/878 solved
  if (this.options.dev || this.options.mode === 'spa') {
    config.optimization.splitChunks.name = true
  }

  // ... Explicit cache groups

  // Vue.js core modules
  if (this.options.build.splitChunks.vue) {
    config.optimization.splitChunks.cacheGroups.vue = {
      test: /node_modules\/(vue|vue-loader|vue-router|vuex|vue-meta)\//,
      chunks: 'initial',
      name: 'vue',
      priority: 10,
      enforce: true
    }
  }

  // Common modules which are usually included in projects
  if (this.options.build.splitChunks.common) {
    config.optimization.splitChunks.cacheGroups.common = {
      test: /node_modules\/(core-js|babel-runtime|lodash|es6-promise|moment|axios|webpack|setimediate|timers-browserify|process)\//,
      chunks: 'initial',
      name: 'common',
      priority: 9
    }
  }

  // Generated templates
  if (this.options.build.splitChunks.main) {
    config.optimization.splitChunks.cacheGroups.main = {
      test: /\.nuxt\//,
      chunks: 'initial',
      name: 'main',
      priority: 8
    }
  }

  // Other vendors inside node_modules
  if (this.options.build.splitChunks.vendor) {
    config.optimization.splitChunks.cacheGroups.vendor = {
      test: /node_modules\//,
      chunks: 'initial',
      name: 'vendor',
      priority: 8
    }
  }

  // Create additional runtime chunk for cache boosting
  config.optimization.runtimeChunk = this.options.build.splitChunks.runtime

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
    if (!this.options.dev && !this.options.test) {
      config.plugins.push(new StylishPlugin())
    }

    // Webpack Bundle Analyzer
    if (this.options.build.analyze) {
      config.plugins.push(
        new BundleAnalyzer.BundleAnalyzerPlugin(Object.assign({}, this.options.build.analyze))
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
