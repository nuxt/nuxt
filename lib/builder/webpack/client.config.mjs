import path from 'path'

import _ from 'lodash'
import webpack from 'webpack'

import HTMLPlugin from 'html-webpack-plugin'
import StylishPlugin from 'webpack-stylish'
import BundleAnalyzer from 'webpack-bundle-analyzer'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'

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

  // -- Optimization --
  config.optimization = this.options.build.optimization

  // Small, known and common modules which are usually used project-wise
  // Sum of them may not be more than 244 KiB
  if (
    this.options.build.splitChunks.commons === true &&
    config.optimization.splitChunks.cacheGroups.commons === undefined
  ) {
    config.optimization.splitChunks.cacheGroups.commons = {
      test: /node_modules\/(vue|vue-loader|vue-router|vuex|vue-meta|core-js|babel-runtime|es6-promise|axios|webpack|setimediate|timers-browserify|process|regenerator-runtime|cookie|js-cookie|is-buffer|dotprop|nuxt\.js)\//,
      chunks: 'all',
      priority: 10,
      name: 'commons'
    }
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

  // CSS extraction
  const extractCSS = this.options.build.extractCSS
  if (extractCSS) {
    config.plugins.push(new MiniCssExtractPlugin(Object.assign({
      filename: this.getFileName('css')
    }, typeof extractCSS === 'object' ? extractCSS : {})))
  }

  return config
}
