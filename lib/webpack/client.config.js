'use strict'

import { each } from 'lodash'
import webpack from 'webpack'
import HTMLPlugin from 'html-webpack-plugin'
import FriendlyErrorsWebpackPlugin from 'friendly-errors-webpack-plugin'
import ScriptExtHtmlWebpackPlugin from 'script-ext-html-webpack-plugin'
import PreloadWebpackPlugin from 'preload-webpack-plugin'
import ProgressBarPlugin from 'progress-bar-webpack-plugin'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import OfflinePlugin from 'offline-plugin'
import base from './base.config.js'
import { resolve } from 'path'
import fs from 'fs-extra'
import pify from 'pify'
const rename = pify(fs.rename)

// offline plugin copy generated assets to static directory
function OfflinePluginCopyAssetsPlugin(assets, toDir) {
  this.assets = assets
  this.toDir = toDir
}
OfflinePluginCopyAssetsPlugin.prototype.apply = function(compiler) {
  compiler.plugin('after-emit', function(compilation, callback) {
    const assets = this.assets.length > 0 ? this.assets : []

    if (!fs.existsSync(this.toDir)){
      fs.mkdirSync(this.toDir)
      fs.mkdirSync(`${this.toDir}/appcache`)
    }

    let renamePromises = []
    assets.forEach((asset) => {
      renamePromises.push(rename(`.nuxt/dist/${asset}`, `${this.toDir}/${asset}`))
    })

    Promise.all(renamePromises)
    .then(() => {
      console.log('\noffline content to static directory...')
    })
    .catch((error) => {
      console.error('\noffline-plugin copy error', error)
    });
  }.bind(this));
}

/*
|--------------------------------------------------------------------------
| Webpack Client Config
|
| Generate public/dist/client-vendor-bundle.js
| Generate public/dist/client-bundle.js
|
| In production, will generate public/dist/style.css
|--------------------------------------------------------------------------
*/
export default function () {
  let config = base.call(this, { isClient: true })

  // Entry
  config.entry.app = resolve(this.dir, '.nuxt', 'client.js')

  // Add vendors
  if (this.options.store) {
    config.entry.vendor.push('vuex')
  }
  config.entry.vendor = config.entry.vendor.concat(this.options.build.vendor)

  // Output
  config.output.path = resolve(this.dir, '.nuxt', 'dist')
  config.output.filename = this.options.build.filenames.app

  // env object defined in nuxt.config.js
  let env = {}
  each(this.options.env, (value, key) => {
    env['process.env.' + key] = (typeof value === 'string' ? JSON.stringify(value) : value)
  })
  // Webpack plugins
  config.plugins = (config.plugins || []).concat([
    // Strip comments in Vue code
    new webpack.DefinePlugin(Object.assign(env, {
      'process.env.NODE_ENV': JSON.stringify(this.dev ? 'development' : 'production'),
      'process.BROWSER_BUILD': true,
      'process.SERVER_BUILD': false,
      'process.browser': true,
      'process.server': true
    })),
    // Extract vendor chunks for better caching
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      filename: this.options.build.filenames.vendor
    }),
    // Extract manifest
    new webpack.optimize.CommonsChunkPlugin({
      name: 'manifest',
      filename: this.options.build.filenames.manifest
    }),
    // Generate output HTML
    new HTMLPlugin({
      template: this.options.appTemplatePath
    }),
    // Add defer to scripts
    new ScriptExtHtmlWebpackPlugin({
      defaultAttribute: 'defer'
    })
  ])

  if (!this.dev && this.options.performance.prefetch === true) {
    // Add prefetch code-splitted routes
    config.plugins.push(
      new PreloadWebpackPlugin({
        rel: 'prefetch'
      })
    )
  }
  // client bundle progress bar
  config.plugins.push(
    new ProgressBarPlugin()
  )
  // Add friendly error plugin
  if (this.dev) {
    config.plugins.push(new FriendlyErrorsWebpackPlugin())
  }
  // Production client build
  if (!this.dev) {
    config.plugins.push(
      // This is needed in webpack 2 for minifying CSS
      new webpack.LoaderOptionsPlugin({
        minimize: true
      }),
      // Minify JS
      new webpack.optimize.UglifyJsPlugin({
        sourceMap: true,
        compress: {
          warnings: false
        }
      })
    )
  }
  // Extend config
  if (typeof this.options.build.extend === 'function') {
    this.options.build.extend.call(this, config, {
      dev: this.dev,
      isClient: true
    })
  }
  // Offline-plugin integration
  if (!this.dev && this.options.offline) {
    const offlineOpts = typeof this.options.offline === 'object' ? this.options.offline : {}
    config.plugins.push(
      new OfflinePlugin(offlineOpts),
      new OfflinePluginCopyAssetsPlugin(
        ['sw.js', 'appcache/manifest.appcache', 'appcache/manifest.html'
      ], 'static')
    )
  }
  // Webpack Bundle Analyzer
  if (!this.dev && this.options.build.analyze) {
    let options = {}
    if (typeof this.options.build.analyze === 'object') {
      options = this.options.build.analyze
    }
    config.plugins.push(
      new BundleAnalyzerPlugin(options)
    )
  }
  return config
}
