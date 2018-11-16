import path from 'path'
import consola from 'consola'
import TimeFixPlugin from 'time-fix-plugin'
import clone from 'lodash/clone'
import cloneDeep from 'lodash/cloneDeep'
import escapeRegExp from 'lodash/escapeRegExp'
import VueLoader from 'vue-loader'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import WebpackBar from 'webpackbar'
import env from 'std-env'

import { isUrl, urlJoin } from '@nuxt/common'

import PerfLoader from './utils/perf-loader'
import StyleLoader from './utils/style-loader'
import WarnFixPlugin from './plugins/warnfix'

export default class WebpackBaseConfig {
  constructor(builder, options) {
    this.name = options.name
    this.isServer = options.isServer
    this.isModern = options.isModern
    this.builder = builder
    this.nuxt = builder.context.nuxt
    this.isStatic = builder.context.isStatic
    this.options = builder.context.options
    this.spinner = builder.spinner
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
    const items = [/\.vue\.js/]
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
      const hash = /\[(chunkhash|contenthash|hash)(?::(\d+))?\]/.exec(fileName)
      if (hash) {
        consola.warn(`Notice: Please do not use ${hash[1]} in dev mode to prevent memory leak`)
      }
    }
    return fileName
  }

  devtool() {
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
    return this.options.build.optimization
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

    return [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: this.loaders.vue
      },
      {
        test: /\.pug$/,
        oneOf: [
          {
            resourceQuery: /^\?vue/,
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
        test: /\.jsx?$/,
        exclude: (file) => {
          // not exclude files outside node_modules
          if (!/node_modules/.test(file)) {
            return false
          }

          // item in transpile can be string or regex object
          return !this.modulesToTranspile.some(module => module.test(file))
        },
        use: perfLoader.js().concat({
          loader: require.resolve('babel-loader'),
          options: this.getBabelOptions()
        })
      },
      {
        test: /\.css$/,
        oneOf: styleLoader.apply('css')
      },
      {
        test: /\.less$/,
        oneOf: styleLoader.apply('less', {
          loader: 'less-loader',
          options: this.loaders.less
        })
      },
      {
        test: /\.sass$/,
        oneOf: styleLoader.apply('sass', {
          loader: 'sass-loader',
          options: this.loaders.sass
        })
      },
      {
        test: /\.scss$/,
        oneOf: styleLoader.apply('scss', {
          loader: 'sass-loader',
          options: this.loaders.scss
        })
      },
      {
        test: /\.styl(us)?$/,
        oneOf: styleLoader.apply('stylus', {
          loader: 'stylus-loader',
          options: this.loaders.stylus
        })
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/,
        use: perfLoader.asset().concat({
          loader: 'url-loader',
          options: Object.assign(
            this.loaders.imgUrl,
            { name: this.getFileName('img') }
          )
        })
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        use: perfLoader.asset().concat({
          loader: 'url-loader',
          options: Object.assign(
            this.loaders.fontUrl,
            { name: this.getFileName('font') }
          )
        })
      },
      {
        test: /\.(webm|mp4|ogv)$/,
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
    const plugins = [new VueLoader.VueLoaderPlugin()]

    Array.prototype.push.apply(plugins, this.options.build.plugins || [])

    // Add timefix-plugin before others plugins
    if (this.options.dev) {
      plugins.unshift(new TimeFixPlugin())
    }

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

    // CSS extraction
    // MiniCssExtractPlugin does not currently supports SSR
    // https://github.com/webpack-contrib/mini-css-extract-plugin/issues/48
    // So we use css-loader/locals as a fallback (utils/style-loader)
    if (this.options.build.extractCSS && !this.isServer) {
      plugins.push(new MiniCssExtractPlugin(Object.assign({
        filename: this.getFileName('css'),
        chunkFilename: this.getFileName('css')
      }, this.options.build.extractCSS)))
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
      devtool: this.devtool(),
      optimization: this.optimization(),
      output: this.output(),
      performance: {
        maxEntrypointSize: 1000 * 1024,
        hints: this.options.dev ? false : 'warning'
      },
      resolve: {
        extensions: ['.wasm', '.mjs', '.js', '.json', '.vue', '.jsx'],
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

    const extendedConfig = this.extendConfig(config)

    // Clone deep avoid leaking config between Client and Server
    return cloneDeep(extendedConfig)
  }
}
