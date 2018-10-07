import path from 'path'
import consola from 'consola'

import TimeFixPlugin from 'time-fix-plugin'
import _ from 'lodash'
import VueLoader from 'vue-loader'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import WebpackBar from 'webpackbar'

import { isUrl, urlJoin } from '../../common/utils'
import StyleLoader from './utils/style-loader'
import WarnFixPlugin from './plugins/warnfix'
import StatsPlugin from './plugins/stats'

export default class WebpackBaseConfig {
  constructor(builder, options) {
    this.name = options.name
    this.isServer = options.isServer
    this.builder = builder
    this.nuxt = this.builder.nuxt
    this.isStatic = builder.isStatic
    this.options = builder.options
    this.spinner = builder.spinner
    this.loaders = this.options.build.loaders
  }

  get nuxtEnv() {
    return {
      isDev: this.options.dev,
      isServer: this.isServer,
      isClient: !this.isServer
    }
  }

  getBabelOptions() {
    const options = _.clone(this.options.build.babel)

    if (typeof options.presets === 'function') {
      options.presets = options.presets({ isServer: this.isServer })
    }

    if (!options.babelrc && !options.presets) {
      options.presets = [
        [
          require.resolve('@nuxtjs/babel-preset-app'),
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
      'process.mode': JSON.stringify(this.options.mode),
      'process.static': this.isStatic
    }
    _.each(this.options.env, (value, key) => {
      env['process.env.' + key] =
        ['boolean', 'number'].indexOf(typeof value) !== -1
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
    const styleLoader = new StyleLoader(
      this.options,
      this.builder.nuxt,
      { isServer: this.isServer }
    )

    const perfLoader = this.builder.perfLoader

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
          if (/node_modules/.test(file)) {
            for (const module of [/\.vue\.js/].concat(this.options.build.transpile)) {
              // item in transpile can be string or regex object
              if (module.test(file)) {
                return false
              }
            }
            return true
          }
        },
        use: perfLoader.pool('js', {
          loader: 'babel-loader',
          options: this.getBabelOptions()
        })
      },
      {
        test: /\.css$/,
        oneOf: perfLoader.poolOneOf('css', styleLoader.apply('css'))
      },
      {
        test: /\.less$/,
        oneOf: perfLoader.poolOneOf('css', styleLoader.apply('less', {
          loader: 'less-loader',
          options: this.loaders.less
        }))
      },
      {
        test: /\.sass$/,
        oneOf: perfLoader.poolOneOf('css', styleLoader.apply('sass', {
          loader: 'sass-loader',
          options: this.loaders.sass
        }))
      },
      {
        test: /\.scss$/,
        oneOf: perfLoader.poolOneOf('css', styleLoader.apply('scss', {
          loader: 'sass-loader',
          options: this.loaders.scss
        }))
      },
      {
        test: /\.styl(us)?$/,
        oneOf: perfLoader.poolOneOf('css', styleLoader.apply('stylus', {
          loader: 'stylus-loader',
          options: this.loaders.stylus
        }))
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/,
        use: perfLoader.pool('assets', {
          loader: 'url-loader',
          options: Object.assign(
            this.loaders.imgUrl,
            { name: this.getFileName('img') }
          )
        })
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        use: perfLoader.pool('assets', {
          loader: 'url-loader',
          options: Object.assign(
            this.loaders.fontUrl,
            { name: this.getFileName('font') }
          )
        })
      },
      {
        test: /\.(webm|mp4|ogv)$/,
        use: perfLoader.pool('assets', {
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
    const plugins = [ new VueLoader.VueLoaderPlugin() ]

    Array.prototype.push.apply(plugins, this.options.build.plugins || [])

    // Add timefix-plugin before others plugins
    if (this.options.dev) {
      plugins.unshift(new TimeFixPlugin())
    }

    // Hide warnings about plugins without a default export (#1179)
    plugins.push(new WarnFixPlugin())

    // Build progress indicator
    plugins.push(new WebpackBar({
      profile: this.options.build.profile,
      name: this.isServer ? 'server' : 'client',
      color: this.isServer ? 'orange' : 'green',
      compiledIn: false,
      done: (states) => {
        if (this.options.dev) {
          const hasErrors = Object.values(states).some(state => state.stats.hasErrors())

          if (!hasErrors) {
            this.nuxt.showReady(false)
          }
        }
      }
    }))

    // Add stats plugin
    if (!this.options.dev && this.options.build.stats) {
      plugins.push(new StatsPlugin(this.options.build.stats))
    }

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
      mode: this.options.dev ? 'development' : 'production',
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
    return _.cloneDeep(extendedConfig)
  }
}
