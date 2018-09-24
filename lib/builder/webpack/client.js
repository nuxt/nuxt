import path from 'path'

import webpack from 'webpack'
import HTMLPlugin from 'html-webpack-plugin'
import BundleAnalyzer from 'webpack-bundle-analyzer'
import TerserWebpackPlugin from 'terser-webpack-plugin'
import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin'
import FriendlyErrorsWebpackPlugin from '@nuxtjs/friendly-errors-webpack-plugin'

import VueSSRClientPlugin from './plugins/vue/client'
import WebpackBaseConfig from './base'

export default class WebpackClientConfig extends WebpackBaseConfig {
  constructor(builder) {
    super(builder, { name: 'client', isServer: false })
  }

  env() {
    return Object.assign(super.env(), {
      'process.env.VUE_ENV': JSON.stringify('client'),
      'process.browser': true,
      'process.client': true,
      'process.server': false
    })
  }

  optimization() {
    const optimization = super.optimization()

    // Small, known and common modules which are usually used project-wise
    // Sum of them may not be more than 244 KiB
    if (
      this.options.build.splitChunks.commons === true &&
      optimization.splitChunks.cacheGroups.commons === undefined
    ) {
      optimization.splitChunks.cacheGroups.commons = {
        test: /node_modules[\\/](vue|vue-loader|vue-router|vuex|vue-meta|core-js|@babel\/runtime|axios|webpack|setimmediate|timers-browserify|process|regenerator-runtime|cookie|js-cookie|is-buffer|dotprop|nuxt\.js)[\\/]/,
        chunks: 'all',
        priority: 10,
        name: true
      }
    }

    return optimization
  }

  plugins() {
    const plugins = super.plugins()

    // Generate output HTML for SSR
    if (this.options.build.ssr) {
      plugins.push(
        new HTMLPlugin({
          filename: '../server/index.ssr.html',
          template: this.options.appTemplatePath,
          minify: true,
          inject: false // Resources will be injected using bundleRenderer
        })
      )
    }

    plugins.push(
      new HTMLPlugin({
        filename: '../server/index.spa.html',
        template: this.options.appTemplatePath,
        minify: true,
        inject: true,
        chunksSortMode: 'dependency'
      }),
      new VueSSRClientPlugin({
        filename: '../server/vue-ssr-client-manifest.json'
      }),
      new webpack.DefinePlugin(this.env())
    )

    if (this.options.dev) {
      // TODO: webpackHotUpdate is not defined: https://github.com/webpack/webpack/issues/6693
      plugins.push(new webpack.HotModuleReplacementPlugin())
    }

    // Webpack Bundle Analyzer
    // https://github.com/webpack-contrib/webpack-bundle-analyzer
    if (!this.options.dev && this.options.build.analyze) {
      const statsDir = path.resolve(this.options.buildDir, 'stats')

      plugins.push(new BundleAnalyzer.BundleAnalyzerPlugin(Object.assign({
        analyzerMode: 'static',
        defaultSizes: 'gzip',
        generateStatsFile: true,
        openAnalyzer: !this.options.build.quiet,
        reportFilename: path.resolve(statsDir, 'client.html'),
        statsFilename: path.resolve(statsDir, 'client.json')
      }, this.options.build.analyze)))
    }

    return plugins
  }

  extendConfig() {
    const config = super.extendConfig(...arguments)

    if (!this.options.dev && !config.optimization.minimizer) {
      config.optimization.minimizer = []

      // https://github.com/webpack-contrib/terser-webpack-plugin
      const terserJsPlugin = new TerserWebpackPlugin({
        parallel: true,
        cache: this.options.build.cache,
        sourceMap: config.devtool && /source-?map/.test(config.devtool),
        extractComments: {
          filename: 'LICENSES'
        },
        terserOptions: {
          output: {
            comments: /^\**!|@preserve|@license|@cc_on/
          }
        }
      })
      config.optimization.minimizer.push(terserJsPlugin)

      // https://github.com/NMFR/optimize-css-assets-webpack-plugin
      // https://github.com/webpack-contrib/mini-css-extract-plugin#minimizing-for-production
      // TODO: Remove OptimizeCSSAssetsPlugin when upgrading to webpack 5
      if (this.options.build.extractCSS) {
        const optimizeCSSPlugin = new OptimizeCSSAssetsPlugin({})
        config.optimization.minimizer.push(optimizeCSSPlugin)
      }
    }

    return config
  }

  config() {
    const config = super.config()

    // Entry points
    config.entry = {
      app: [path.resolve(this.options.buildDir, 'client.js')]
    }

    // Add HMR support
    if (this.options.dev) {
      config.entry.app.unshift(
        // https://github.com/glenjamin/webpack-hot-middleware#config
        `webpack-hot-middleware/client?name=client&reload=true&timeout=30000&path=${
          this.options.router.base
        }/__webpack_hmr`.replace(/\/\//g, '/')
      )
    }

    // Add friendly error plugin
    if (this.options.dev && !this.options.build.quiet) {
      config.plugins.push(
        new FriendlyErrorsWebpackPlugin({
          clearConsole: true,
          logLevel: 'WARNING'
        })
      )
    }

    return config
  }
}
