import { each, defaults } from 'lodash'
import webpack from 'webpack'
import VueSSRClientPlugin from 'vue-server-renderer/client-plugin'
import HTMLPlugin from 'html-webpack-plugin'
import FriendlyErrorsWebpackPlugin from 'friendly-errors-webpack-plugin'
import ProgressBarPlugin from 'progress-bar-webpack-plugin'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import OfflinePlugin from 'offline-plugin'
import { resolve } from 'path'
import base from './base.config.js'

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
export default function webpackClientConfig () {
  let config = base.call(this, { isClient: true })

  // Entry
  config.entry.app = resolve(this.options.buildDir, 'client.js')

  // Add vendors
  if (this.options.store) {
    config.entry.vendor.push('vuex')
  }
  config.entry.vendor = config.entry.vendor.concat(this.options.build.vendor)

  // Output
  config.output.path = resolve(this.options.buildDir, 'dist')
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
      'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV || (this.options.dev ? 'development' : 'production')),
      'process.BROWSER_BUILD': true,
      'process.SERVER_BUILD': false,
      'process.browser': true,
      'process.server': true
    })),
    // Extract vendor chunks for better caching
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      filename: this.options.build.filenames.vendor,
      minChunks (module) {
        // A module is extracted into the vendor chunk when...
        return (
          // If it's inside node_modules
          /node_modules/.test(module.context) &&
          // Do not externalize if the request is a CSS file
          !/\.(css|less|scss|sass|styl|stylus)$/.test(module.request)
        )
      }
    }),
    // Extract webpack runtime & manifest
    new webpack.optimize.CommonsChunkPlugin({
      name: 'manifest',
      minChunks: Infinity,
      filename: this.options.build.filenames.manifest
    }),
    // Generate output HTML
    new HTMLPlugin({
      template: this.options.appTemplatePath,
      inject: false // <- Resources will be injected using vue server renderer
    }),
    // Generate client manifest json
    new VueSSRClientPlugin({
      filename: 'client-manifest.json'
    })
  ])
  // client bundle progress bar
  config.plugins.push(
    new ProgressBarPlugin()
  )
  // Add friendly error plugin
  if (this.options.dev) {
    config.plugins.push(new FriendlyErrorsWebpackPlugin())
  }
  // Production client build
  if (!this.options.dev) {
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
      dev: this.options.dev,
      isClient: true
    })
  }
  // Offline-plugin integration
  if (!this.options.dev && this.options.offline) {
    const offlineOpts = typeof this.options.offline === 'object' ? this.options.offline : {}
    config.plugins.push(
      new OfflinePlugin(defaults(offlineOpts, {}))
    )
  }
  // Webpack Bundle Analyzer
  if (!this.options.dev && this.options.build.analyze) {
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
