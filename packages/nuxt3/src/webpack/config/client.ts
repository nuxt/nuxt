import path from 'path'
import querystring from 'querystring'
import webpack from 'webpack'
import HTMLPlugin from 'html-webpack-plugin'
import BundleAnalyzer from 'webpack-bundle-analyzer'
import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin'
import FriendlyErrorsWebpackPlugin from '@nuxt/friendly-errors-webpack-plugin'

import CorsPlugin from '../plugins/vue/cors'
import ModernModePlugin from '../plugins/vue/modern'
import VueSSRClientPlugin from '../plugins/vue/client'
import WebpackBaseConfig from './base'

export default class WebpackClientConfig extends WebpackBaseConfig {
  constructor (builder) {
    super(builder)
    this.name = 'client'
    this.isServer = false
    this.isModern = false
  }

  get devtool () {
    if (!this.dev) {
      return false
    }
    const scriptPolicy = this.getCspScriptPolicy()
    const noUnsafeEval = scriptPolicy && !scriptPolicy.includes('\'unsafe-eval\'')
    return noUnsafeEval
      ? 'cheap-module-source-map'
      : 'eval-cheap-module-source-map'
  }

  getCspScriptPolicy () {
    const { csp } = this.buildContext.options.render
    if (csp) {
      const { policies = {} } = csp
      return policies['script-src'] || policies['default-src'] || []
    }
  }

  env () {
    return Object.assign(
      super.env(),
      {
        'process.env.VUE_ENV': JSON.stringify('client'),
        'process.browser': true,
        'process.client': true,
        'process.server': false,
        'process.modern': false
      }
    )
  }

  optimization () {
    const optimization = super.optimization()
    const { splitChunks } = optimization
    const { cacheGroups } = splitChunks

    // Small, known and common modules which are usually used project-wise
    // Sum of them may not be more than 244 KiB
    if (
      this.buildContext.buildOptions.splitChunks.commons === true &&
      cacheGroups.commons === undefined
    ) {
      cacheGroups.commons = {
        test: /node_modules[\\/](vue|vue-loader|vue-router|vuex|vue-meta|core-js|@babel\/runtime|axios|webpack|setimmediate|timers-browserify|process|regenerator-runtime|cookie|js-cookie|is-buffer|dotprop|nuxt\.js)[\\/]/,
        chunks: 'all',
        priority: 10,
        name: 'commons',
        automaticNameDelimiter: '/'
      }
    }

    if (!this.dev && cacheGroups.default && cacheGroups.default.name === undefined) {
      cacheGroups.default.name = (_module, chunks) => {
        // Use default name for single chunks
        if (chunks.length === 1) {
          return chunks[0].name || ''
        }
        // Use compact name for concatinated modules
        return 'commons/' + chunks.filter(c => c.name).map(c =>
          c.name.replace(/\//g, '.').replace(/_/g, '').replace('pages.', '')
        ).join('~')
      }
    }

    return optimization
  }

  minimizer () {
    const minimizer = super.minimizer()
    const { optimizeCSS } = this.buildContext.buildOptions

    // https://github.com/NMFR/optimize-css-assets-webpack-plugin
    // https://github.com/webpack-contrib/mini-css-extract-plugin#minimizing-for-production
    // TODO: Remove OptimizeCSSAssetsPlugin when upgrading to webpack 5
    if (optimizeCSS) {
      minimizer.push(new OptimizeCSSAssetsPlugin(Object.assign({}, optimizeCSS)))
    }

    return minimizer
  }

  alias () {
    const aliases = super.alias()

    for (const p of this.buildContext.plugins) {
      if (!aliases[p.name]) {
        // Do not load server-side plugins on client-side
        aliases[p.name] = p.mode === 'server' ? './empty.js' : p.src
      }
    }

    return aliases
  }

  plugins () {
    const plugins = super.plugins()
    const { buildOptions, options: { appTemplatePath, buildDir, modern, render } } = this.buildContext

    // Generate output HTML for SSR
    if (buildOptions.ssr) {
      plugins.push(
        new HTMLPlugin({
          filename: '../server/index.ssr.html',
          template: appTemplatePath,
          minify: buildOptions.html.minify,
          inject: false // Resources will be injected using bundleRenderer
        })
      )
    }

    plugins.push(
      new HTMLPlugin({
        filename: '../server/index.spa.html',
        template: appTemplatePath,
        minify: buildOptions.html.minify,
        inject: true
      }),
      new VueSSRClientPlugin({
        filename: `../server/${this.name}.manifest.json`
      }),
      new webpack.DefinePlugin(this.env())
    )

    if (this.dev) {
      // TODO: webpackHotUpdate is not defined: https://github.com/webpack/webpack/issues/6693
      plugins.push(new webpack.HotModuleReplacementPlugin())
    }

    // Webpack Bundle Analyzer
    // https://github.com/webpack-contrib/webpack-bundle-analyzer
    if (!this.dev && buildOptions.analyze) {
      const statsDir = path.resolve(buildDir, 'stats')

      plugins.push(new BundleAnalyzer.BundleAnalyzerPlugin(Object.assign({
        analyzerMode: 'static',
        defaultSizes: 'gzip',
        generateStatsFile: true,
        openAnalyzer: !buildOptions.quiet,
        reportFilename: path.resolve(statsDir, `${this.name}.html`),
        statsFilename: path.resolve(statsDir, `${this.name}.json`)
      }, buildOptions.analyze)))
    }

    if (modern) {
      const scriptPolicy = this.getCspScriptPolicy()
      const noUnsafeInline = scriptPolicy && !scriptPolicy.includes('\'unsafe-inline\'')
      plugins.push(new ModernModePlugin({
        targetDir: path.resolve(buildDir, 'dist', 'client'),
        isModernBuild: this.isModern,
        noUnsafeInline
      }))
    }

    if (render.crossorigin) {
      plugins.push(new CorsPlugin({
        crossorigin: render.crossorigin
      }))
    }

    return plugins
  }

  config () {
    const config = super.config()
    const {
      options: { router, buildDir },
      buildOptions: { hotMiddleware, quiet, friendlyErrors }
    } = this.buildContext

    const { client = {} } = hotMiddleware || {}
    const { ansiColors, overlayStyles, ...options } = client

    const hotMiddlewareClientOptions = {
      reload: true,
      timeout: 30000,
      ansiColors: JSON.stringify(ansiColors),
      overlayStyles: JSON.stringify(overlayStyles),
      path: `${router.base}/__webpack_hmr/${this.name}`.replace(/\/\//g, '/'),
      ...options,
      name: this.name
    }

    const hotMiddlewareClientOptionsStr = querystring.stringify(hotMiddlewareClientOptions)

    // Entry points
    config.entry = Object.assign({}, config.entry, {
      app: [path.resolve(buildDir, 'entry.client.ts')]
    })

    // Add HMR support
    if (this.dev) {
      config.entry.app.unshift(
        // https://github.com/webpack-contrib/webpack-hot-middleware/issues/53#issuecomment-162823945
        'eventsource-polyfill',
        // https://github.com/glenjamin/webpack-hot-middleware#config
        `webpack-hot-middleware/client?${hotMiddlewareClientOptionsStr}`
      )
    }

    // Add friendly error plugin
    if (this.dev && !quiet && friendlyErrors) {
      config.plugins.push(
        new FriendlyErrorsWebpackPlugin({
          clearConsole: false,
          reporter: 'consola',
          logLevel: 'WARNING'
        })
      )
    }

    return config
  }
}
