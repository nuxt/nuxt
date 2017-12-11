import ExtractTextPlugin from 'extract-text-webpack-plugin'
import { cloneDeep } from 'lodash'
import { join, resolve } from 'path'
import webpack from 'webpack'
import { isUrl, urlJoin } from 'utils'
import TimeFixPlugin from './plugins/timefix'
import WarnFixPlugin from './plugins/warnfix'

/*
|--------------------------------------------------------------------------
| Webpack Shared Config
|
| This is the config which is extended by the server and client
| webpack config files
|--------------------------------------------------------------------------
*/
export default function webpackBaseConfig({ name, isServer }) {
  const nodeModulesDir = join(__dirname, '..', 'node_modules')

  const config = {
    name,
    devtool: this.options.dev ? 'cheap-module-eval-source-map' : false,
    entry: {
      app: null
    },
    output: {
      path: resolve(this.options.buildDir, 'dist'),
      filename: this.getFileName('app'),
      chunkFilename: this.getFileName('chunk'),
      publicPath: (isUrl(this.options.build.publicPath)
        ? this.options.build.publicPath
        : urlJoin(this.options.router.base, this.options.build.publicPath))
    },
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
      modules: [
        ...this.options.modulesDir,
        nodeModulesDir
      ]
    },
    resolveLoader: {
      modules: [
        ...this.options.modulesDir,
        nodeModulesDir
      ]
    },
    module: {
      noParse: /es6-promise\.js$/, // Avoid webpack shimming process
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader',
          options: this.vueLoader({ isServer })
        },
        {
          test: /\.js$/,
          loader: 'babel-loader',
          exclude: /node_modules/,
          options: this.getBabelOptions({ isServer })
        },
        { test: /\.css$/, use: this.styleLoader('css') },
        { test: /\.less$/, use: this.styleLoader('less', 'less-loader') },
        { test: /\.sass$/, use: this.styleLoader('sass', {loader: 'sass-loader', options: { indentedSyntax: true }}) },
        { test: /\.scss$/, use: this.styleLoader('scss', 'sass-loader') },
        { test: /\.styl(us)?$/, use: this.styleLoader('stylus', 'stylus-loader') },
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

  // --------------------------------------
  // Dev specific config
  // --------------------------------------
  if (this.options.dev) {
    //
  }

  // --------------------------------------
  // Production specific config
  // --------------------------------------
  if (!this.options.dev) {
    // This is needed in webpack 2 for minify CSS
    config.plugins.push(
      new webpack.LoaderOptionsPlugin({
        minimize: true
      })
    )
  }

  // Clone deep avoid leaking config between Client and Server
  return cloneDeep(config)
}
