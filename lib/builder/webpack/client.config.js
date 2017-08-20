import { each } from 'lodash'
import webpack from 'webpack'
import VueSSRClientPlugin from 'vue-server-renderer/client-plugin'
import HTMLPlugin from 'html-webpack-plugin'
import FriendlyErrorsWebpackPlugin from 'friendly-errors-webpack-plugin'
import ProgressBarPlugin from 'progress-bar-webpack-plugin'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import MinifyPlugin from 'babel-minify-webpack-plugin'
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

  config.name = 'client'

  // App entry
  config.entry.app = resolve(this.options.buildDir, 'client.js')

  // Add vendors
  // This vendors should explicitly extracted
  // Even if not used in 50% of the chunks!
  const vendor = [
    'vue',
    'vue-router',
    'vue-meta',
    'core-js',
    'regenerator-runtime',
    'es6-promise',
    'babel-runtime',
    'vuex'
  ].concat(this.options.build.vendor).filter(v => v)

  // Extract vendor chunks for better caching
  const _this = this
  config.plugins.push(
    new webpack.optimize.CommonsChunkPlugin({
      name: 'common',
      filename: this.options.build.filenames.vendor,
      minChunks (module, count) {
        // In the dev we use on-demand-entries.
        // So, it makes no sense to use commonChunks based on the minChunks count.
        // Instead, we move all the code in node_modules into each of the pages.
        if (_this.options.dev) {
          return false
        }

        // Extract all explicit vendor modules
        if (module.context && vendor.some(v => module.context.includes(v))) {
          return true
        }

        // Total pages
        const totalPages = _this.routes ? _this.routes.length : 0

        // A module is extracted into the vendor chunk when...
        return (
          // If it's inside node_modules
          /node_modules/.test(module.context) &&
          // Do not externalize if the request is a CSS file
          !/\.(css|less|scss|sass|styl|stylus)$/.test(module.request) &&
          // Used in at-least 1/2 of the total pages
          (totalPages <= 2 ? count >= totalPages : count >= totalPages * 0.5)
        )
      }
    })
  )

  // Env object defined in nuxt.config.js
  let env = {}
  each(this.options.env, (value, key) => {
    env['process.env.' + key] = (typeof value === 'string' ? JSON.stringify(value) : value)
  })

  // Webpack common plugins
  /* istanbul ignore if */
  if (!Array.isArray(config.plugins)) {
    config.plugins = []
  }

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

  // Extract webpack runtime & manifest
  config.plugins.push(
    new webpack.optimize.CommonsChunkPlugin({
      name: 'manifest',
      minChunks: Infinity,
      filename: this.options.build.filenames.manifest
    })
  )

  // Define Env
  config.plugins.push(
    new webpack.DefinePlugin(Object.assign(env, {
      'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV || (this.options.dev ? 'development' : 'production')),
      'process.env.VUE_ENV': JSON.stringify('client'),
      'process.browser': true,
      'process.server': false,
      'process.static': this.isStatic
    }))
  )

  // Build progress bar
  config.plugins.push(
    new ProgressBarPlugin()
  )

  // --------------------------------------
  // Dev specific config
  // --------------------------------------
  if (this.options.dev) {
    // Add friendly error plugin
    config.plugins.push(new FriendlyErrorsWebpackPlugin())

    // https://webpack.js.org/plugins/named-modules-plugin
    config.plugins.push(new webpack.NamedModulesPlugin())

    // Add HMR support
    config.entry.app = ['webpack-hot-middleware/client?name=client&reload=true', config.entry.app]
    config.plugins.push(
      new webpack.HotModuleReplacementPlugin(),
      new webpack.NoEmitOnErrorsPlugin()
    )
  }

  // --------------------------------------
  // Production specific config
  // --------------------------------------
  if (!this.options.dev) {
    // Scope Hoisting
    config.plugins.push(
      new webpack.optimize.ModuleConcatenationPlugin()
    )

    // https://webpack.js.org/plugins/hashed-module-ids-plugin
    config.plugins.push(new webpack.HashedModuleIdsPlugin())

    // Minify JS

    // https://github.com/webpack-contrib/babel-minify-webpack-plugin
    config.plugins.push(new MinifyPlugin())

    // https://github.com/webpack-contrib/uglifyjs-webpack-plugin
    config.plugins.push(
      new webpack.optimize.UglifyJsPlugin({
        sourceMap: true,
        extractComments: {
          filename: 'LICENSES'
        },
        compress: {
          warnings: false
        }
      })
    )

    // Webpack Bundle Analyzer
    if (this.options.build.analyze) {
      config.plugins.push(
        new BundleAnalyzerPlugin(Object.assign({}, this.options.build.analyze))
      )
    }
  }

  // Extend config
  if (typeof this.options.build.extend === 'function') {
    this.options.build.extend.call(this, config, {
      dev: this.options.dev,
      isClient: true
    })
  }

  return config
}
