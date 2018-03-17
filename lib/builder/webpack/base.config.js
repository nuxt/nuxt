const ExtractTextPlugin = require('extract-text-webpack-plugin')
const TimeFixPlugin = require('time-fix-plugin')
const WarnFixPlugin = require('./plugins/warnfix')
const ProgressPlugin = require('./plugins/progress')

const webpack = require('webpack')
const { cloneDeep } = require('lodash')
const { join, resolve } = require('path')

const { isUrl, urlJoin } = require('../../common/utils')

const vueLoader = require('./vue-loader')
const styleLoader = require('./style-loader')

/*
|--------------------------------------------------------------------------
| Webpack Shared Config
|
| This is the config which is extended by the server and client
| webpack config files
|--------------------------------------------------------------------------
*/
module.exports = function webpackBaseConfig({ name, isServer }) {
  // Prioritize nested node_modules in webpack search path (#2558)
  const webpackModulesDir = ['node_modules'].concat(this.options.modulesDir)

  const configAlias = {}

  // Used by vue-loader so we can use in templates
  // with <img src="~/assets/nuxt.png"/>
  configAlias[this.options.dir.assets] = join(
    this.options.srcDir,
    this.options.dir.assets
  )
  configAlias[this.options.dir.static] = join(
    this.options.srcDir,
    this.options.dir.static
  )

  const config = {
    name,
    mode: this.options.dev ? 'development' : 'production',
    optimization: {},
    output: {
      path: resolve(this.options.buildDir, 'dist'),
      filename: this.getFileName('app'),
      chunkFilename: this.getFileName('chunk'),
      publicPath: isUrl(this.options.build.publicPath)
        ? this.options.build.publicPath
        : urlJoin(this.options.router.base, this.options.build.publicPath)
    },
    performance: {
      hints: this.options.dev ? false : 'warning'
    },
    resolve: {
      extensions: ['.js', '.json', '.vue', '.jsx'],
      alias: Object.assign(
        {
          '~': join(this.options.srcDir),
          '~~': join(this.options.rootDir),
          '@': join(this.options.srcDir),
          '@@': join(this.options.rootDir)
        },
        configAlias
      ),
      modules: webpackModulesDir
    },
    resolveLoader: {
      modules: webpackModulesDir
    },
    module: {
      noParse: /es6-promise\.js$/, // Avoid webpack shimming process
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader',
          options: vueLoader.call(this, { isServer })
        },
        {
          test: /\.jsx?$/,
          loader: 'babel-loader',
          exclude: /node_modules/,
          options: this.getBabelOptions({ isServer })
        },
        { test: /\.css$/, use: styleLoader.call(this, 'css') },
        { test: /\.less$/, use: styleLoader.call(this, 'less', 'less-loader') },
        {
          test: /\.sass$/,
          use: styleLoader.call(this, 'sass', {
            loader: 'sass-loader',
            options: { indentedSyntax: true }
          })
        },
        { test: /\.scss$/, use: styleLoader.call(this, 'scss', 'sass-loader') },
        {
          test: /\.styl(us)?$/,
          use: styleLoader.call(this, 'stylus', 'stylus-loader')
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/,
          loader: 'url-loader',
          options: {
            limit: 1000, // 1KO
            name: 'img/[name].[hash:7].[ext]'
          }
        },
        {
          test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
          loader: 'url-loader',
          options: {
            limit: 1000, // 1 KO
            name: 'fonts/[name].[hash:7].[ext]'
          }
        },
        {
          test: /\.(webm|mp4)$/,
          loader: 'file-loader',
          options: {
            name: 'videos/[name].[hash:7].[ext]'
          }
        }
      ]
    },
    plugins: this.options.build.plugins
  }

  // Build progress indicator
  if (this.options.build.profile) {
    config.plugins.push(new webpack.ProgressPlugin({ profile: true }))
  } else {
    config.plugins.push(new ProgressPlugin({
      spinner: this.spinner,
      name: isServer ? 'server' : 'client',
      color: isServer ? 'green' : 'darkgreen'
    }))
  }

  // Add timefix-plugin before others plugins
  if (this.options.dev) {
    config.plugins.unshift(new TimeFixPlugin())
  }

  // Hide warnings about plugins without a default export (#1179)
  config.plugins.push(new WarnFixPlugin())

  // CSS extraction
  const extractCSS = this.options.build.extractCSS
  if (extractCSS) {
    const extractOptions = Object.assign(
      { filename: this.getFileName('css') },
      typeof extractCSS === 'object' ? extractCSS : {}
    )
    config.plugins.push(new ExtractTextPlugin(extractOptions))
  }

  // Clone deep avoid leaking config between Client and Server
  return cloneDeep(config)
}
