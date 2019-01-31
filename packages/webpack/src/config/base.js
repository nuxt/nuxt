import path from 'path'
import consola from 'consola'
import TimeFixPlugin from 'time-fix-plugin'
import clone from 'lodash/clone'
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
import WarnFixPlugin from '../plugins/warnfix'

import { reservedVueTags } from '../utils/reserved-tags'

export default class WebpackBaseConfig {
  constructor(builder, options) {
    this.name = options.name
    this.isServer = options.isServer
    this.isModern = options.isModern
    this.builder = builder
    this.nuxt = builder.context.nuxt
    this.isStatic = builder.context.isStatic
    this.options = builder.context.options
    this.loaders = this.options.build.loaders
    this.buildMode = this.options.dev ? 'development' : 'production'
    this.modulesToTranspile = this.normalizeTranspile()
  }

  get colors() {
    return {
      client: 'green',
      server: 'orange',
      modern: 'blue'
    }
  }

  get nuxtEnv() {
    return {
      isDev: this.options.dev,
      isServer: this.isServer,
      isClient: !this.isServer,
      isModern: !!this.isModern
    }
  }

  normalizeTranspile() {
    // include SFCs in node_modules
    const items = [/\.vue\.js/i]
    for (const pattern of this.options.build.transpile) {
      if (pattern instanceof RegExp) {
        items.push(pattern)
      } else {
        const posixModule = pattern.replace(/\\/g, '/')
        items.push(new RegExp(escapeRegExp(path.normalize(posixModule))))
      }
    }
    return items
  }

  getBabelOptions() {
    const options = clone(this.options.build.babel)

    if (typeof options.presets === 'function') {
      options.presets = options.presets({ isServer: this.isServer })
    }

    if (!options.babelrc && !options.presets) {
      options.presets = [
        [
          require.resolve('@nuxt/babel-preset-app'),
          {
            buildTarget: this.isServer ? 'server' : 'client'
          }
        ]
      ]
    }

    return options
  }

  getFileName(key) {
    let fileName = this.options.build.filenames[key]
    if (typeof fileName === 'function') {
      fileName = fileName(this.nuxtEnv)
    }
    if (this.options.dev) {
      const hash = /\[(chunkhash|contenthash|hash)(?::(\d+))?]/.exec(fileName)
      if (hash) {
        consola.warn(`Notice: Please do not use ${hash[1]} in dev mode to prevent memory leak`)
      }
    }
    return fileName
  }

  get devtool() {
    return false
  }

  env() {
    const env = {
      'process.env.NODE_ENV': JSON.stringify(this.buildMode),
      'process.mode': JSON.stringify(this.options.mode),
      'process.static': this.isStatic
    }
    Object.entries(this.options.env).forEach(([key, value]) => {
      env['process.env.' + key] =
        ['boolean', 'number'].includes(typeof value)
          ? value
          : JSON.stringify(value)
    })
    return env
  }

  output() {
    return {
      path: path.resolve(this.options.buildDir, 'dist', this.isServer ? 'server' : 'client'),
      filename: this.getFileName('app'),
      chunkFilename: this.getFileName('chunk'),
      publicPath: isUrl(this.options.build.publicPath)
        ? this.options.build.publicPath
        : urlJoin(this.options.router.base, this.options.build.publicPath)
    }
  }

  optimization() {
    const optimization = cloneDeep(this.options.build.optimization)

    if (optimization.minimize && optimization.minimizer === undefined) {
      optimization.minimizer = this.minimizer()
    }

    return optimization
  }

  minimizer() {
    const minimizer = []

    // https://github.com/webpack-contrib/terser-webpack-plugin
    if (this.options.build.terser) {
      minimizer.push(
        new TerserWebpackPlugin(Object.assign({
          parallel: true,
          cache: this.options.build.cache,
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
        }, this.options.build.terser))
      )
    }

    return minimizer
  }

  alias() {
    const { srcDir, rootDir, dir: { assets: assetsDir, static: staticDir } } = this.options

    return {
      '~': path.join(srcDir),
      '~~': path.join(rootDir),
      '@': path.join(srcDir),
      '@@': path.join(rootDir),
      [assetsDir]: path.join(srcDir, assetsDir),
      [staticDir]: path.join(srcDir, staticDir)
    }
  }

  rules() {
    const perfLoader = new PerfLoader(this)
    const styleLoader = new StyleLoader(
      this.options,
      this.nuxt,
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
        test: /\.ts$/i,
        use: [
          babelLoader,
          {
            loader: 'ts-loader',
            options: this.loaders.ts
          }
        ]
      },
      {
        test: /\.tsx$/i,
        use: [
          babelLoader,
          {
            loader: 'ts-loader',
            options: this.loaders.tsx
          }
        ]
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
        use: perfLoader.asset().concat({
          loader: 'url-loader',
          options: Object.assign(
            this.loaders.imgUrl,
            { name: this.getFileName('img') }
          )
        })
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/i,
        use: perfLoader.asset().concat({
          loader: 'url-loader',
          options: Object.assign(
            this.loaders.fontUrl,
            { name: this.getFileName('font') }
          )
        })
      },
      {
        test: /\.(webm|mp4|ogv)$/i,
        use: perfLoader.asset().concat({
          loader: 'file-loader',
          options: Object.assign(
            this.loaders.file,
            { name: this.getFileName('video') }
          )
        })
      }
    ]
  }

  plugins() {
    const plugins = []

    // Add timefix-plugin before others plugins
    if (this.options.dev) {
      plugins.push(new TimeFixPlugin())
    }

    // CSS extraction)
    if (this.options.build.extractCSS) {
      plugins.push(new ExtractCssChunksPlugin(Object.assign({
        filename: this.getFileName('css'),
        chunkFilename: this.getFileName('css'),
        // TODO: https://github.com/faceyspacey/extract-css-chunks-webpack-plugin/issues/132
        reloadAll: true
      }, this.options.build.extractCSS)))
    }

    plugins.push(new VueLoader.VueLoaderPlugin())

    Array.prototype.push.apply(plugins, this.options.build.plugins || [])

    // Hide warnings about plugins without a default export (#1179)
    plugins.push(new WarnFixPlugin())

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
      basic: !this.options.build.quiet && env.minimalCLI,
      fancy: !this.options.build.quiet && !env.minimalCLI,
      profile: !this.options.build.quiet && this.options.build.profile,
      stats: !this.options.build.quiet && !this.options.dev && this.options.build.stats,
      reporter: {
        change: (_, { shortPath }) => {
          if (!this.isServer) {
            this.nuxt.callHook('bundler:change', shortPath)
          }
        },
        done: (context) => {
          if (context.hasErrors) {
            this.nuxt.callHook('bundler:error')
          }
        },
        allDone: () => {
          this.nuxt.callHook('bundler:done')
        }
      }
    }))

    if (this.options.build.hardSource) {
      plugins.push(new HardSourcePlugin(Object.assign({}, this.options.build.hardSource)))
    }

    return plugins
  }

  extendConfig(config) {
    if (typeof this.options.build.extend === 'function') {
      const extendedConfig = this.options.build.extend.call(
        this.builder, config, { loaders: this.loaders, ...this.nuxtEnv }
      )
      // Only overwrite config when something is returned for backwards compatibility
      if (extendedConfig !== undefined) {
        return extendedConfig
      }
    }
    return config
  }

  config() {
    // Prioritize nested node_modules in webpack search path (#2558)
    const webpackModulesDir = ['node_modules'].concat(this.options.modulesDir)

    const config = {
      name: this.name,
      mode: this.buildMode,
      devtool: this.devtool,
      optimization: this.optimization(),
      output: this.output(),
      performance: {
        maxEntrypointSize: 1000 * 1024,
        hints: this.options.dev ? false : 'warning'
      },
      resolve: {
        extensions: ['.wasm', '.mjs', '.js', '.json', '.vue', '.jsx', '.ts', '.tsx'],
        alias: this.alias(),
        modules: webpackModulesDir
      },
      resolveLoader: {
        modules: webpackModulesDir
      },
      module: {
        rules: this.rules()
      },
      plugins: this.plugins()
    }

    // Clone deep avoid leaking config between Client and Server
    const extendedConfig = this.extendConfig(cloneDeep(config))
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
