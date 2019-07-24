import path from 'path'
import consola from 'consola'
import TimeFixPlugin from 'time-fix-plugin'
import cloneDeep from 'lodash/cloneDeep'
import escapeRegExp from 'lodash/escapeRegExp'
import VueLoader from 'vue-loader'
import ExtractCssChunksPlugin from 'extract-css-chunks-webpack-plugin'
import HardSourcePlugin from 'hard-source-webpack-plugin'
import TerserWebpackPlugin from 'terser-webpack-plugin'
import WebpackBar from 'webpackbar'
import env from 'std-env'

import { isUrl, urlJoin } from '@nuxt/utils'

import PerfLoader from '../utils/perf-loader'
import StyleLoader from '../utils/style-loader'
import WarningIgnorePlugin from '../plugins/warning-ignore'

import { reservedVueTags } from '../utils/reserved-tags'

export default class WebpackBaseConfig {
  constructor (builder) {
    this.builder = builder
    this.buildContext = builder.buildContext
    this.modulesToTranspile = this.normalizeTranspile()
  }

  get colors () {
    return {
      client: 'green',
      server: 'orange',
      modern: 'blue'
    }
  }

  get nuxtEnv () {
    return {
      isDev: this.dev,
      isServer: this.isServer,
      isClient: !this.isServer,
      isModern: Boolean(this.isModern)
    }
  }

  get mode () {
    return this.dev ? 'development' : 'production'
  }

  get dev () {
    return this.buildContext.options.dev
  }

  get loaders () {
    return this.buildContext.buildOptions.loaders
  }

  normalizeTranspile () {
    // include SFCs in node_modules
    const items = [/\.vue\.js/i]
    for (const pattern of this.buildContext.buildOptions.transpile) {
      if (pattern instanceof RegExp) {
        items.push(pattern)
      } else {
        const posixModule = pattern.replace(/\\/g, '/')
        items.push(new RegExp(escapeRegExp(path.normalize(posixModule))))
      }
    }
    return items
  }

  getBabelOptions () {
    const options = {
      ...this.buildContext.buildOptions.babel,
      envName: this.name
    }

    if (options.configFile !== false) {
      return options
    }

    const defaultPreset = [
      require.resolve('@nuxt/babel-preset-app'),
      {
        buildTarget: this.isServer ? 'server' : 'client'
      }
    ]

    if (typeof options.presets === 'function') {
      options.presets = options.presets({ isServer: this.isServer }, defaultPreset)
    }

    if (!options.babelrc && !options.presets) {
      options.presets = [ defaultPreset ]
    }

    return options
  }

  getFileName (key) {
    let fileName = this.buildContext.buildOptions.filenames[key]
    if (typeof fileName === 'function') {
      fileName = fileName(this.nuxtEnv)
    }
    if (this.dev) {
      const hash = /\[(chunkhash|contenthash|hash)(?::(\d+))?]/.exec(fileName)
      if (hash) {
        consola.warn(`Notice: Please do not use ${hash[1]} in dev mode to prevent memory leak`)
      }
    }
    return fileName
  }

  get devtool () {
    return false
  }

  env () {
    const env = {
      'process.env.NODE_ENV': JSON.stringify(this.mode),
      'process.mode': JSON.stringify(this.mode),
      'process.static': this.buildContext.isStatic
    }
    Object.entries(this.buildContext.options.env).forEach(([key, value]) => {
      env['process.env.' + key] =
        ['boolean', 'number'].includes(typeof value)
          ? value
          : JSON.stringify(value)
    })
    return env
  }

  output () {
    const {
      options: { buildDir, router },
      buildOptions: { publicPath }
    } = this.buildContext
    return {
      path: path.resolve(buildDir, 'dist', this.isServer ? 'server' : 'client'),
      filename: this.getFileName('app'),
      futureEmitAssets: true, // TODO: Remove when using webpack 5
      chunkFilename: this.getFileName('chunk'),
      publicPath: isUrl(publicPath) ? publicPath : urlJoin(router.base, publicPath)
    }
  }

  optimization () {
    const optimization = cloneDeep(this.buildContext.buildOptions.optimization)

    if (optimization.minimize && optimization.minimizer === undefined) {
      optimization.minimizer = this.minimizer()
    }

    return optimization
  }

  resolve () {
    // Prioritize nested node_modules in webpack search path (#2558)
    const webpackModulesDir = ['node_modules'].concat(this.buildContext.options.modulesDir)

    return {
      resolve: {
        extensions: ['.wasm', '.mjs', '.js', '.json', '.vue', '.jsx'],
        alias: this.alias(),
        modules: webpackModulesDir
      },
      resolveLoader: {
        modules: webpackModulesDir
      }
    }
  }

  minimizer () {
    const minimizer = []
    const { terser, cache } = this.buildContext.buildOptions

    // https://github.com/webpack-contrib/terser-webpack-plugin
    if (terser) {
      minimizer.push(
        new TerserWebpackPlugin(Object.assign({
          parallel: true,
          cache,
          sourceMap: this.devtool && /source-?map/.test(this.devtool),
          extractComments: {
            filename: 'LICENSES'
          },
          terserOptions: {
            compress: {
              ecma: this.isModern ? 6 : undefined
            },
            output: {
              comments: /^\**!|@preserve|@license|@cc_on/
            },
            mangle: {
              reserved: reservedVueTags
            }
          }
        }, terser))
      )
    }

    return minimizer
  }

  alias () {
    return {
      ...this.buildContext.options.alias,
      consola: require.resolve(`consola/dist/consola${this.isServer ? '' : '.browser'}.js`)
    }
  }

  rules () {
    const perfLoader = new PerfLoader(this.name, this.buildContext)
    const styleLoader = new StyleLoader(
      this.buildContext,
      { isServer: this.isServer, perfLoader }
    )

    const babelLoader = {
      loader: require.resolve('babel-loader'),
      options: this.getBabelOptions()
    }

    return [
      {
        test: /\.vue$/i,
        loader: 'vue-loader',
        options: this.loaders.vue
      },
      {
        test: /\.pug$/i,
        oneOf: [
          {
            resourceQuery: /^\?vue/i,
            use: [{
              loader: 'pug-plain-loader',
              options: this.loaders.pugPlain
            }]
          },
          {
            use: [
              'raw-loader',
              {
                loader: 'pug-plain-loader',
                options: this.loaders.pugPlain
              }
            ]
          }
        ]
      },
      {
        test: /\.jsx?$/i,
        exclude: (file) => {
          file = file.split('node_modules', 2)[1]

          // not exclude files outside node_modules
          if (!file) {
            return false
          }

          // item in transpile can be string or regex object
          return !this.modulesToTranspile.some(module => module.test(file))
        },
        use: perfLoader.js().concat(babelLoader)
      },
      {
        test: /\.css$/i,
        oneOf: styleLoader.apply('css')
      },
      {
        test: /\.p(ost)?css$/i,
        oneOf: styleLoader.apply('postcss')
      },
      {
        test: /\.less$/i,
        oneOf: styleLoader.apply('less', {
          loader: 'less-loader',
          options: this.loaders.less
        })
      },
      {
        test: /\.sass$/i,
        oneOf: styleLoader.apply('sass', {
          loader: 'sass-loader',
          options: this.loaders.sass
        })
      },
      {
        test: /\.scss$/i,
        oneOf: styleLoader.apply('scss', {
          loader: 'sass-loader',
          options: this.loaders.scss
        })
      },
      {
        test: /\.styl(us)?$/i,
        oneOf: styleLoader.apply('stylus', {
          loader: 'stylus-loader',
          options: this.loaders.stylus
        })
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        use: [{
          loader: 'url-loader',
          options: Object.assign(
            this.loaders.imgUrl,
            { name: this.getFileName('img') }
          )
        }]
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/i,
        use: [{
          loader: 'url-loader',
          options: Object.assign(
            this.loaders.fontUrl,
            { name: this.getFileName('font') }
          )
        }]
      },
      {
        test: /\.(webm|mp4|ogv)$/i,
        use: [{
          loader: 'file-loader',
          options: Object.assign(
            this.loaders.file,
            { name: this.getFileName('video') }
          )
        }]
      }
    ]
  }

  plugins () {
    const plugins = []
    const { nuxt, buildOptions } = this.buildContext

    // Add timefix-plugin before others plugins
    if (this.dev) {
      plugins.push(new TimeFixPlugin())
    }

    // CSS extraction)
    if (buildOptions.extractCSS) {
      plugins.push(new ExtractCssChunksPlugin(Object.assign({
        filename: this.getFileName('css'),
        chunkFilename: this.getFileName('css')
      }, buildOptions.extractCSS)))
    }

    plugins.push(new VueLoader.VueLoaderPlugin())

    plugins.push(...(buildOptions.plugins || []))

    plugins.push(new WarningIgnorePlugin(this.warningIgnoreFilter()))

    // Build progress indicator
    plugins.push(new WebpackBar({
      name: this.name,
      color: this.colors[this.name],
      reporters: [
        'basic',
        'fancy',
        'profile',
        'stats'
      ],
      basic: !buildOptions.quiet && env.minimalCLI,
      fancy: !buildOptions.quiet && !env.minimalCLI,
      profile: !buildOptions.quiet && buildOptions.profile,
      stats: !buildOptions.quiet && !this.dev && buildOptions.stats,
      reporter: {
        change: (_, { shortPath }) => {
          if (!this.isServer) {
            nuxt.callHook('bundler:change', shortPath)
          }
        },
        done: (buildContext) => {
          if (buildContext.hasErrors) {
            nuxt.callHook('bundler:error')
          }
        },
        allDone: () => {
          nuxt.callHook('bundler:done')
        },
        progress ({ statesArray }) {
          nuxt.callHook('bundler:progress', statesArray)
        }
      }
    }))

    if (buildOptions.hardSource) {
      // https://github.com/mzgoddard/hard-source-webpack-plugin
      plugins.push(new HardSourcePlugin({
        info: {
          level: 'warn'
        },
        ...buildOptions.hardSource
      }))
    }

    return plugins
  }

  warningIgnoreFilter () {
    const filters = [
      // Hide warnings about plugins without a default export (#1179)
      warn => warn.name === 'ModuleDependencyWarning' &&
        warn.message.includes(`export 'default'`) &&
        warn.message.includes('nuxt_plugin_'),
      ...(this.buildContext.buildOptions.warningIgnoreFilters || [])
    ]

    return warn => !filters.some(ignoreFilter => ignoreFilter(warn))
  }

  extendConfig (config) {
    const { extend } = this.buildContext.buildOptions
    if (typeof extend === 'function') {
      const extendedConfig = extend.call(
        this.builder, config, { loaders: this.loaders, ...this.nuxtEnv }
      )
      // Only overwrite config when something is returned for backwards compatibility
      if (extendedConfig !== undefined) {
        return extendedConfig
      }
    }
    return config
  }

  config () {
    const config = {
      name: this.name,
      mode: this.mode,
      devtool: this.devtool,
      optimization: this.optimization(),
      output: this.output(),
      performance: {
        maxEntrypointSize: 1000 * 1024,
        hints: this.dev ? false : 'warning'
      },
      module: {
        rules: this.rules()
      },
      plugins: this.plugins(),
      ...this.resolve()
    }

    // Clone deep avoid leaking config between Client and Server
    const extendedConfig = cloneDeep(this.extendConfig(config))
    const { optimization } = extendedConfig
    // Todo remove in nuxt 3 in favor of devtool config property or https://webpack.js.org/plugins/source-map-dev-tool-plugin
    if (optimization && optimization.minimizer && extendedConfig.devtool) {
      const terser = optimization.minimizer.find(p => p instanceof TerserWebpackPlugin)
      if (terser) {
        terser.options.sourceMap = /source-?map/.test(extendedConfig.devtool)
      }
    }

    return extendedConfig
  }
}
