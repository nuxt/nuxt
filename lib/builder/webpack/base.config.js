const ExtractTextPlugin = require('extract-text-webpack-plugin')
const { cloneDeep } = require('lodash')
const { join, resolve } = require('path')
const { isUrl, urlJoin } = require('../../common/utils')
const vueLoader = require('./vue-loader')
const styleLoader = require('./style-loader')
const TimeFixPlugin = require('./plugins/timefix')
const WarnFixPlugin = require('./plugins/warnfix')

/*
|--------------------------------------------------------------------------
| Webpack Shared Config
|
| This is the config which is extended by the server and client
| webpack config files
|--------------------------------------------------------------------------
*/
module.exports = function webpackBaseConfig({ name, isServer }) {
  const config = {
    name,
    devtool: this.options.dev ? 'cheap-eval-source-map' : false,
    entry: {
      app: null
    },
    output: {
      path: resolve(this.options.buildDir, 'dist'),
      filename: this.getFileName('app'),
      chunkFilename: this.getFileName('chunk'),
      publicPath: (isUrl(this.options.build.publicPath)
        ? this.options.build.publicPath
        : urlJoin(this.options.router.base, this.options.build.publicPath)),
      devtoolModuleFilenameTemplate: '[absolute-resource-path]'
    },
    cache: !this.options.dev,
    performance: {
      maxEntrypointSize: 1000000,
      maxAssetSize: 300000,
      hints: this.options.dev ? false : 'warning'
    },
    resolve: {
      extensions: ['.js', '.json', '.vue', '.ts'],
      alias: {
        '~': join(this.options.srcDir),
        '~~': join(this.options.rootDir),
        '@': join(this.options.srcDir),
        '@@': join(this.options.rootDir),
        // Used by vue-loader so we can use in templates
        // with <img src="~/assets/nuxt.png"/>
        'assets': join(this.options.srcDir, 'assets'),
        'static': join(this.options.srcDir, 'static')
      },
      modules: this.options.modulesDir
    },
    resolveLoader: {
      modules: this.options.modulesDir
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
          test: /\.js$/,
          loader: 'babel-loader',
          exclude: /node_modules/,
          options: this.getBabelOptions({ isServer })
        },
        { test: /\.css$/, use: styleLoader.call(this, 'css') },
        { test: /\.less$/, use: styleLoader.call(this, 'less', 'less-loader') },
        { test: /\.sass$/, use: styleLoader.call(this, 'sass', {loader: 'sass-loader', options: { indentedSyntax: true }}) },
        { test: /\.scss$/, use: styleLoader.call(this, 'scss', 'sass-loader') },
        { test: /\.styl(us)?$/, use: styleLoader.call(this, 'stylus', 'stylus-loader') },
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
