import path from 'path'

import webpack from 'webpack'
import HTMLPlugin from 'html-webpack-plugin'
import BundleAnalyzer from 'webpack-bundle-analyzer'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import UglifyJsWebpackPlugin from 'uglifyjs-webpack-plugin'

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

  plugins() {
    const plugins = super.plugins()

    // Generate output HTML for SSR
    if (this.options.build.ssr) {
      plugins.push(
        new HTMLPlugin({
          filename: 'index.ssr.html',
          template: 'lodash!' + this.options.appTemplatePath,
          inject: false // Resources will be injected using bundleRenderer
        })
      )
    }

    plugins.push(
      new HTMLPlugin({
        filename: 'index.spa.html',
        template: 'lodash!' + this.options.appTemplatePath,
        inject: true,
        chunksSortMode: 'dependency'
      }),
      new VueSSRClientPlugin({
        filename: 'vue-ssr-client-manifest.json'
      }),
      new webpack.DefinePlugin(this.env())
    )

    if (this.options.dev) {
      plugins.push(new webpack.HotModuleReplacementPlugin())
    }

    // Chunks size limit
    // https://webpack.js.org/plugins/aggressive-splitting-plugin/
    if (!this.options.dev && this.options.build.maxChunkSize) {
      plugins.push(
        new webpack.optimize.AggressiveSplittingPlugin({
          minSize: this.options.build.maxChunkSize,
          maxSize: this.options.build.maxChunkSize
        })
      )
    }

    // Webpack Bundle Analyzer
    if (!this.options.dev && this.options.build.analyze) {
      plugins.push(
        new BundleAnalyzer.BundleAnalyzerPlugin(Object.assign({}, this.options.build.analyze))
      )
    }

    // CSS extraction
    const extractCSS = this.options.build.extractCSS
    if (extractCSS) {
      plugins.push(new MiniCssExtractPlugin(Object.assign({
        filename: this.getFileName('css')
      }, typeof extractCSS === 'object' ? extractCSS : {})))
    }

    return plugins
  }

  config() {
    let config = super.config()

    // Entry points
    config.entry = path.resolve(this.options.buildDir, 'client.js')

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

    // Make uglifyjs faster
    if (!this.options.dev && !config.optimization.minimizer) {
      // https://github.com/webpack-contrib/uglifyjs-webpack-plugin
      config.optimization.minimizer = [
        new UglifyJsWebpackPlugin({
          parallel: true,
          cache: true,
          sourceMap: false
        })
      ]
    }

    // Add HMR support
    if (this.options.dev) {
      config.entry = [
        // https://github.com/glenjamin/webpack-hot-middleware#config
        `webpack-hot-middleware/client?name=client&reload=true&timeout=30000&path=${
          this.options.router.base
        }/__webpack_hmr`.replace(/\/\//g, '/'),
        config.entry
      ]
    }

    // Extend config
    if (typeof this.options.build.extend === 'function') {
      const isDev = this.options.dev
      const extendedConfig = this.options.build.extend.call(this.builder, config, {
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
}
