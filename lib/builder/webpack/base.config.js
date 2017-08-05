import ExtractTextPlugin from 'extract-text-webpack-plugin'
import { defaults, cloneDeep } from 'lodash'
import { join, resolve } from 'path'
import webpack from 'webpack'
import { isUrl, urlJoin } from 'utils'
import autoprefixer from 'autoprefixer'
import vueLoaderConfig from './vue-loader.config'
import { styleLoader, extractStyles } from './helpers'

/*
|--------------------------------------------------------------------------
| Webpack Shared Config
|
| This is the config which is extended by the server and client
| webpack config files
|--------------------------------------------------------------------------
*/
export default function webpackBaseConfig ({ isClient, isServer }) {
  const nodeModulesDir = join(__dirname, '..', 'node_modules')

  // Enable autoprefixer if both autoprefixer postcss are enabled
  if (this.options.build.autoprefixer && Array.isArray(this.options.build.postcss)) {
    this.options.build.postcss.push(autoprefixer(this.options.build.autoprefixer))
  }

  const config = {
    devtool: this.options.dev ? 'cheap-module-source-map' : 'nosources-source-map',
    entry: {
      vendor: ['vue', 'vue-router', 'vue-meta']
    },
    output: {
      path: resolve(this.options.buildDir, 'dist'),
      filename: this.options.build.filenames.app,
      chunkFilename: this.options.build.filenames.chunk,
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
        // with <img src="~/assets/nuxt.png" />        
        'assets': join(this.options.srcDir, 'assets'),
        'static': join(this.options.srcDir, 'static')
      },
      modules: [
        this.options.modulesDir,
        nodeModulesDir
      ]
    },
    resolveLoader: {
      modules: [
        this.options.modulesDir,
        nodeModulesDir
      ]
    },
    module: {
      noParse: /es6-promise\.js$/, // avoid webpack shimming process
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader',
          query: vueLoaderConfig.call(this, { isClient, isServer })
        },
        {
          test: /\.js$/,
          loader: 'babel-loader',
          exclude: /node_modules/,
          query: defaults(this.options.build.babel, {
            presets: [require.resolve('babel-preset-vue-app')],
            babelrc: false,
            cacheDirectory: !!this.options.dev
          })
        },
        { test: /\.css$/, use: styleLoader.call(this, 'css') },
        { test: /\.less$/, use: styleLoader.call(this, 'less', 'less-loader') },
        { test: /\.sass$/, use: styleLoader.call(this, 'sass', 'sass-loader?indentedSyntax&sourceMap') },
        { test: /\.scss$/, use: styleLoader.call(this, 'sass', 'sass-loader?sourceMap') },
        { test: /\.styl(us)?$/, use: styleLoader.call(this, 'stylus', 'stylus-loader') },
        {
          test: /\.(png|jpe?g|gif|svg)$/,
          loader: 'url-loader',
          query: {
            limit: 1000, // 1KO
            name: 'img/[name].[hash:7].[ext]'
          }
        },
        {
          test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
          loader: 'url-loader',
          query: {
            limit: 1000, // 1 KO
            name: 'fonts/[name].[hash:7].[ext]'
          }
        },
        {
          test: /\.(webm|mp4)$/,
          loader: 'file',
          query: {
            name: 'videos/[name].[hash:7].[ext]'
          }
        }
      ]
    },
    plugins: this.options.build.plugins
  }

  // CSS extraction
  if (extractStyles.call(this)) {
    config.plugins.push(
      new ExtractTextPlugin({ filename: this.options.build.filenames.css })
    )
  }

  // Workaround for hiding Warnings about plugins without a default export (#1179)
  config.plugins.push({
    apply (compiler) {
      compiler.plugin('done', stats => {
        stats.compilation.warnings = stats.compilation.warnings.filter(warn => {
          if (warn.name === 'ModuleDependencyWarning' && warn.message.includes(`export 'default'`) && warn.message.includes('plugin')) {
            return false
          }
          return true
        })
      })
    }
  })

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

    // Scope Hoisting
    // config.plugins.push(
    //   new webpack.optimize.ModuleConcatenationPlugin()
    // )
  }

  // Clone deep avoid leaking config between Client and Server
  return cloneDeep(config)
}
