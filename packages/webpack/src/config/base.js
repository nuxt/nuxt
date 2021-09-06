import path from 'path'
import consola from 'consola'
import TimeFixPlugin from 'time-fix-plugin'
import { escapeRegExp, cloneDeep } from 'lodash'
import VueLoader from 'vue-loader'
import ExtractCssChunksPlugin from 'extract-css-chunks-webpack-plugin'
import * as PnpWebpackPlugin from 'pnp-webpack-plugin'
import HardSourcePlugin from 'hard-source-webpack-plugin'
import TerserWebpackPlugin from 'terser-webpack-plugin'
import WebpackBar from 'webpackbar'
import env from 'std-env'
import semver from 'semver'
import { isRelative } from 'ufo'

import { TARGETS, isUrl, urlJoin, getPKG, tryResolve, requireModule, resolveModule } from '@nuxt/utils'

import PerfLoader from '../utils/perf-loader'
import StyleLoader from '../utils/style-loader'
import WarningIgnorePlugin from '../plugins/warning-ignore'
import { Watchpack2Plugin } from '../plugins/watchpack'
import { reservedVueTags } from '../utils/reserved-tags'

export default class WebpackBaseConfig {
  constructor (builder) {
    this.builder = builder
    this.buildContext = builder.buildContext
    this.resolveModule = id => tryResolve(id, [this.buildContext.options.rootDir, __dirname]) || id
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
      isModern: Boolean(this.isModern),
      isLegacy: Boolean(!this.isModern)
    }
  }

  get mode () {
    return this.dev ? 'development' : 'production'
  }

  get target () {
    return this.buildContext.target
  }

  get dev () {
    return this.buildContext.options.dev
  }

  get loaders () {
    if (!this._loaders) {
      this._loaders = cloneDeep(this.buildContext.buildOptions.loaders)
      // sass-loader<8 support (#6460)
      const sassLoaderPKG = getPKG('sass-loader')
      if (sassLoaderPKG && semver.lt(sassLoaderPKG.version, '8.0.0')) {
        const { sass } = this._loaders
        sass.indentedSyntax = sass.sassOptions.indentedSyntax
        delete sass.sassOptions.indentedSyntax
      }
    }
    return this._loaders
  }

  get modulesToTranspile () {
    return [
      /\.vue\.js/i, // include SFCs in node_modules
      /consola\/src/,
      /ufo/, // exports modern syntax for browser field
      ...this.normalizeTranspile({ pathNormalize: true })
    ]
  }

  normalizeTranspile ({ pathNormalize = false } = {}) {
    const transpile = []
    for (let pattern of this.buildContext.buildOptions.transpile) {
      if (typeof pattern === 'function') {
        pattern = pattern(this.nuxtEnv)
      }
      if (pattern instanceof RegExp) {
        transpile.push(pattern)
      } else if (typeof pattern === 'string') {
        const posixModule = pattern.replace(/\\/g, '/')
        transpile.push(new RegExp(escapeRegExp(
          pathNormalize ? path.normalize(posixModule) : posixModule
        )))
      }
    }
    return transpile
  }

  getBabelOptions () {
    const envName = this.name
    const { buildOptions: { corejs }, options: { rootDir } } = this.buildContext
    const options = {
      ...this.buildContext.buildOptions.babel,
      envName
    }

    if (options.configFile || options.babelrc) {
      return options
    }

    if (typeof options.plugins === 'function') {
      options.plugins = options.plugins(
        {
          envName,
          ...this.nuxtEnv
        }
      )
    }

    // Auto detect corejs version
    let corejsVersion = corejs
    if (corejsVersion === 'auto') {
      try {
        corejsVersion = Number.parseInt(requireModule('core-js/package.json', rootDir).version.split('.')[0])
      } catch (_err) {
        corejsVersion = 2
      }
    } else {
      corejsVersion = Number.parseInt(corejsVersion)
    }

    if (![2, 3].includes(corejsVersion)) {
      consola.warn(`Invalid corejs version ${corejsVersion}! Please set "build.corejs" to either "auto", 2 or 3.`)
      corejsVersion = 2
    }

    const defaultPreset = [this.resolveModule('@nuxt/babel-preset-app'), {
      corejs: {
        version: corejsVersion
      }
    }]

    if (typeof options.presets === 'function') {
      options.presets = options.presets(
        {
          envName,
          ...this.nuxtEnv
        },
        defaultPreset
      )
    }

    if (!options.presets) {
      options.presets = [defaultPreset]
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
    if (this.buildContext.buildOptions.analyze && !fileName.includes('[name]')) {
      fileName = '[name].' + fileName
    }
    return fileName
  }

  env () {
    const env = {
      'process.env.NODE_ENV': JSON.stringify(this.mode),
      'process.mode': JSON.stringify(this.mode),
      'process.dev': this.dev,
      'process.static': this.target === TARGETS.static,
      'process.target': JSON.stringify(this.target)
    }
    if (this.buildContext.buildOptions.aggressiveCodeRemoval) {
      env['typeof process'] = JSON.stringify(this.isServer ? 'object' : 'undefined')
      env['typeof window'] = JSON.stringify(!this.isServer ? 'object' : 'undefined')
      env['typeof document'] = JSON.stringify(!this.isServer ? 'object' : 'undefined')
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
      publicPath: isUrl(publicPath) ? publicPath : isRelative(publicPath) ? publicPath.replace(/^\.+\//, '/') : urlJoin(router.base, publicPath)
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

    const resolvePath = [
      ...(global.__NUXT_PREPATHS__ || []),
      this.buildContext.options.rootDir,
      __dirname,
      ...(global.__NUXT_PATHS__ || []),
      resolveModule('@nuxt/vue-app'),
      resolveModule('@nuxt/babel-preset-app')
    ]
    const resolvePlugins = [PnpWebpackPlugin].concat(resolvePath.map(p => PnpWebpackPlugin.moduleLoader(p)))

    return {
      resolve: {
        extensions: ['.wasm', '.mjs', '.js', '.json', '.vue', '.jsx'],
        alias: this.alias(),
        modules: webpackModulesDir,
        plugins: resolvePlugins
      },
      resolveLoader: {
        modules: [
          path.resolve(__dirname, '../node_modules'),
          ...webpackModulesDir
        ],
        plugins: resolvePlugins
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
          cache,
          extractComments: {
            condition: 'some',
            filename: 'LICENSES'
          },
          terserOptions: {
            compress: {
              ecma: this.isModern ? 2015 : undefined
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
      'vue-meta': this.resolveModule(`vue-meta${this.isServer ? '' : '/dist/vue-meta.esm.browser.js'}`)
    }
  }

  rules () {
    const perfLoader = new PerfLoader(this.name, this.buildContext, { resolveModule: this.resolveModule })
    const styleLoader = new StyleLoader(
      this.buildContext,
      { isServer: this.isServer, perfLoader, resolveModule: this.resolveModule }
    )

    const babelLoader = {
      loader: this.resolveModule('babel-loader'),
      options: this.getBabelOptions()
    }

    return [
      {
        test: /\.vue$/i,
        loader: this.resolveModule('vue-loader'),
        options: this.loaders.vue
      },
      {
        test: /\.pug$/i,
        oneOf: [
          {
            resourceQuery: /^\?vue/i,
            use: [{
              loader: this.resolveModule('pug-plain-loader'),
              options: this.loaders.pugPlain
            }]
          },
          {
            use: [
              this.resolveModule('raw-loader'),
              {
                loader: this.resolveModule('pug-plain-loader'),
                options: this.loaders.pugPlain
              }
            ]
          }
        ]
      },
      {
        test: /\.m?jsx?$/i,
        type: 'javascript/auto',
        exclude: (file) => {
          file = file.split(/node_modules(.*)/)[1]

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
          loader: this.resolveModule('less-loader'),
          options: this.loaders.less
        })
      },
      {
        test: /\.sass$/i,
        oneOf: styleLoader.apply('sass', {
          loader: this.resolveModule('sass-loader'),
          options: this.loaders.sass
        })
      },
      {
        test: /\.scss$/i,
        oneOf: styleLoader.apply('scss', {
          loader: this.resolveModule('sass-loader'),
          options: this.loaders.scss
        })
      },
      {
        test: /\.styl(us)?$/i,
        oneOf: styleLoader.apply('stylus', {
          loader: this.resolveModule('stylus-loader'),
          options: this.loaders.stylus
        })
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp|avif)$/i,
        use: [{
          loader: this.resolveModule('url-loader'),
          options: Object.assign(
            this.loaders.imgUrl,
            { name: this.getFileName('img') }
          )
        }]
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/i,
        use: [{
          loader: this.resolveModule('url-loader'),
          options: Object.assign(
            this.loaders.fontUrl,
            { name: this.getFileName('font') }
          )
        }]
      },
      {
        test: /\.(webm|mp4|ogv)$/i,
        use: [{
          loader: this.resolveModule('file-loader'),
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

    plugins.push(new Watchpack2Plugin())

    return plugins
  }

  warningIgnoreFilter () {
    const filters = [
      // Hide warnings about plugins without a default export (#1179)
      warn => warn.name === 'ModuleDependencyWarning' &&
        warn.message.includes('export \'default\'') &&
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
      ) || config

      const pragma = /@|#/
      const { devtool } = extendedConfig
      if (typeof devtool === 'string' && pragma.test(devtool)) {
        extendedConfig.devtool = devtool.replace(pragma, '')
        consola.warn(`devtool has been normalized to ${extendedConfig.devtool} as webpack documented value`)
      }

      return extendedConfig
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

    return extendedConfig
  }
}
