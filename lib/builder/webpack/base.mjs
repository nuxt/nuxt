import path from 'path'

import TimeFixPlugin from 'time-fix-plugin'
import webpack from 'webpack'
import _ from 'lodash'
import VueLoader from 'vue-loader'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'

import { isUrl, urlJoin } from '../../common/utils'

import customLoaders from './loaders'
import StyleLoader from './utils/style-loader'
import WarnFixPlugin from './plugins/warnfix'
import ProgressPlugin from './plugins/progress'
import StatsPlugin from './plugins/stats'

export default class WebpackBaseConfig {
  constructor(builder, options) {
    this.name = options.name
    this.isServer = options.isServer
    this.builder = builder
    this.isStatic = builder.isStatic
    this.options = builder.options
    this.spinner = builder.spinner
  }

  getBabelOptions() {
    const options = _.clone(this.options.build.babel)

    if (typeof options.presets === 'function') {
      options.presets = options.presets({ isServer: this.isServer })
    }

    if (!options.babelrc && !options.presets) {
      options.presets = [
        [
          this.builder.nuxt.resolvePath('babel-preset-vue-app'),
          {
            targets: this.isServer ? { node: '8.0.0' } : { ie: 9, uglify: true }
          }
        ]
      ]
    }

    return options
  }

  getFileName(name) {
    let fileName = this.options.build.filenames[name]

    // Don't use hashes when watching
    // https://github.com/webpack/webpack/issues/1914#issuecomment-174171709
    if (this.options.dev) {
      fileName = fileName.replace(/\[(chunkhash|contenthash|hash)\]\./g, '')
    }

    // Don't use [name] for production assets
    if (!this.options.dev && this.options.build.optimization.splitChunks.name !== true) {
      fileName = fileName.replace(/\[name\]\./g, '')
    }

    return fileName
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
      path: path.resolve(this.options.buildDir, 'dist'),
      filename: this.getFileName('app'),
      chunkFilename: this.getFileName('chunk'),
      publicPath: isUrl(this.options.build.publicPath)
        ? this.options.build.publicPath
        : urlJoin(this.options.router.base, this.options.build.publicPath)
    }
  }

  alias() {
    return {
      '~': path.join(this.options.srcDir),
      '~~': path.join(this.options.rootDir),
      '@': path.join(this.options.srcDir),
      '@@': path.join(this.options.rootDir),
      [this.options.dir.assets]: path.join(
        this.options.srcDir,
        this.options.dir.assets
      ),
      [this.options.dir.static]: path.join(
        this.options.srcDir,
        this.options.dir.static
      )
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
        options: Object.assign({
          productionMode: !this.options.dev,
          template: {
            doctype: 'html' // For pug, see https://github.com/vuejs/vue-loader/issues/55
          },
          transformAssetUrls: {
            video: 'src',
            source: 'src',
            object: 'src',
            embed: 'src'
          }
        }, this.options.build.vueLoader)
      },
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: perfLoader.pool('js', {
          loader: 'babel-loader',
          options: this.getBabelOptions()
        })
      },
      {
        test: /\.css$/,
        use: perfLoader.pool('css', styleLoader.apply('css'))
      },
      {
        test: /\.less$/,
        use: perfLoader.pool('css', styleLoader.apply('less', 'less-loader'))
      },
      {
        test: /\.sass$/,
        use: perfLoader.pool('css', styleLoader.apply('sass', {
          loader: 'sass-loader',
          options: { indentedSyntax: true }
        }))
      },
      {
        test: /\.scss$/,
        use: perfLoader.pool('css', styleLoader.apply('scss', 'sass-loader'))
      },
      {
        test: /\.styl(us)?$/,
        use: perfLoader.pool('css', styleLoader.apply('stylus', 'stylus-loader'))
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        use: perfLoader.pool('assets', {
          loader: 'url-loader',
          options: {
            limit: 1000, // 1KO
            name: 'img/[name].[hash:7].[ext]'
          }
        })
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        use: perfLoader.pool('assets', {
          loader: 'url-loader',
          options: {
            limit: 1000, // 1 KO
            name: 'fonts/[name].[hash:7].[ext]'
          }
        })
      },
      {
        test: /\.(webm|mp4)$/,
        use: perfLoader.pool('assets', {
          loader: 'file-loader',
          options: {
            name: 'videos/[name].[hash:7].[ext]'
          }
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
    if (!this.options.test) {
      if (this.options.build.profile) {
        plugins.push(new webpack.ProgressPlugin({ profile: true }))
      } else {
        if (!(this.options.minimalCLI)) {
          plugins.push(new ProgressPlugin({
            spinner: this.spinner,
            name: this.isServer ? 'server' : 'client',
            color: this.isServer ? 'orange' : 'green'
          }))
        }
      }
    }

    // Add stats plugin
    if (!this.options.dev) {
      plugins.push(new StatsPlugin(this.options.build.stats))
    }

    // CSS extraction
    // MiniCssExtractPlugin does not currently supports SSR
    // https://github.com/webpack-contrib/mini-css-extract-plugin/issues/48
    // So we use css-loader/locals as a fallback (utils/style-loader)
    if (this.options.build.extractCSS && !this.isServer) {
      plugins.push(new MiniCssExtractPlugin(Object.assign({
        filename: this.getFileName('css')
      }, this.options.build.extractCSS)))
    }

    return plugins
  }

  config() {
    // Prioritize nested node_modules in webpack search path (#2558)
    const webpackModulesDir = ['node_modules'].concat(this.options.modulesDir)

    const config = {
      name: this.name,
      mode: this.options.dev ? 'development' : 'production',
      optimization: {},
      output: this.output(),
      performance: {
        maxEntrypointSize: 1000 * 1024,
        hints: this.options.dev ? false : 'warning'
      },
      resolve: {
        extensions: ['.js', '.json', '.vue', '.jsx'],
        alias: this.alias(),
        modules: webpackModulesDir
      },
      resolveLoader: {
        alias: customLoaders,
        modules: webpackModulesDir
      },
      module: {
        noParse: /es6-promise\.js$/, // Avoid webpack shimming process
        rules: this.rules()
      },
      plugins: this.plugins()
    }

    // Clone deep avoid leaking config between Client and Server
    return _.cloneDeep(config)
  }
}
