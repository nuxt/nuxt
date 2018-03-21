import path from 'path'

import ExtractTextPlugin from 'extract-text-webpack-plugin'
import FriendlyErrorsWebpackPlugin from '@nuxtjs/friendly-errors-webpack-plugin'
import TimeFixPlugin from 'time-fix-plugin'
import webpack from 'webpack'
import _ from 'lodash'

import { isUrl, urlJoin } from '../../common/utils'

import WarnFixPlugin from './plugins/warnfix'
import ProgressPlugin from './plugins/progress'
import vueLoader from './vue-loader'
import styleLoader from './style-loader'

/*
|--------------------------------------------------------------------------
| Webpack Shared Config
|
| This is the config which is extended by the server and client
| webpack config files
|--------------------------------------------------------------------------
*/
export default function webpackBaseConfig({ name, isServer }) {
  // Prioritize nested node_modules in webpack search path (#2558)
  const webpackModulesDir = ['node_modules'].concat(this.options.modulesDir)

  const configAlias = {}

  // Used by vue-loader so we can use in templates
  // with <img src="~/assets/nuxt.png"/>
  configAlias[this.options.dir.assets] = path.join(
    this.options.srcDir,
    this.options.dir.assets
  )
  configAlias[this.options.dir.static] = path.join(
    this.options.srcDir,
    this.options.dir.static
  )

  const config = {
    name,
    mode: this.options.dev ? 'development' : 'production',
    optimization: {},
    output: {
      path: path.resolve(this.options.buildDir, 'dist'),
      filename: this.getFileName('app'),
      chunkFilename: this.getFileName('chunk'),
      publicPath: isUrl(this.options.build.publicPath)
        ? this.options.build.publicPath
        : urlJoin(this.options.router.base, this.options.build.publicPath)
    },
    performance: {
      maxEntrypointSize: 1000 * 1024,
      hints: this.options.dev ? false : 'warning'
    },
    resolve: {
      extensions: ['.js', '.json', '.vue', '.jsx'],
      alias: Object.assign(
        {
          '~': path.join(this.options.srcDir),
          '~~': path.join(this.options.rootDir),
          '@': path.join(this.options.srcDir),
          '@@': path.join(this.options.rootDir)
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
  if (!this.options.test) {
    if (this.options.build.profile) {
      config.plugins.push(new webpack.ProgressPlugin({ profile: true }))
    } else {
      if (!(this.options.minimalCLI)) {
        config.plugins.push(new ProgressPlugin({
          spinner: this.spinner,
          name: isServer ? 'server' : 'client',
          color: isServer ? 'green' : 'darkgreen'
        }))
      }
    }
  }

  // Add timefix-plugin before others plugins
  if (this.options.dev) {
    config.plugins.unshift(new TimeFixPlugin())
  }

  // Hide warnings about plugins without a default export (#1179)
  config.plugins.push(new WarnFixPlugin())

  const shouldClearConsole =
    this.options.build.stats !== false &&
    this.options.build.stats !== 'errors-only'

  // Add friendly error plugin
  config.plugins.push(
    new FriendlyErrorsWebpackPlugin({
      clearConsole: shouldClearConsole,
      logLevel: 'WARNING'
    })
  )

  // CSS extraction
  const extractCSS = this.options.build.extractCSS
  // TODO: Temporary disabled in dev mode for fixing source maps
  // (We need `source-map` devtool for *.css modules)
  if (extractCSS && !this.options.dev) {
    config.plugins.push(new ExtractTextPlugin(Object.assign({
      filename: this.getFileName('css'),
      allChunks: true
    }, typeof extractCSS === 'object' ? extractCSS : {})))
  }

  // Clone deep avoid leaking config between Client and Server
  return _.cloneDeep(config)
}
