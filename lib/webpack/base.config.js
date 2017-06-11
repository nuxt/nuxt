import vueLoaderConfig from './vue-loader.config'
import { defaults } from 'lodash'
import { join } from 'path'
import { isUrl, urlJoin } from '../utils'
import { styleLoader, extractStyles } from './helpers'
import ExtractTextPlugin from 'extract-text-webpack-plugin'

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
  let config = {
    devtool: (this.options.dev ? 'cheap-module-source-map' : false),
    entry: {
      vendor: ['vue', 'vue-router', 'vue-meta']
    },
    output: {
      publicPath: (isUrl(this.options.build.publicPath)
        ? this.options.build.publicPath
        : urlJoin(this.options.router.base, this.options.build.publicPath))
    },
    performance: {
      maxEntrypointSize: 300000,
      maxAssetSize: 300000,
      hints: (this.options.dev ? false : 'warning')
    },
    resolve: {
      extensions: ['.js', '.json', '.vue', '.ts'],
      // Disable for now
      alias: {
        '~': join(this.options.srcDir),
        'static': join(this.options.srcDir, 'static'), // use in template with <img src="~static/nuxt.png" />
        '~static': join(this.options.srcDir, 'static'),
        'assets': join(this.options.srcDir, 'assets'), // use in template with <img src="~assets/nuxt.png" />
        '~assets': join(this.options.srcDir, 'assets'),
        '~plugins': join(this.options.srcDir, 'plugins'),
        '~store': join(this.options.buildDir, 'store'),
        '~router': join(this.options.buildDir, 'router'),
        '~pages': join(this.options.srcDir, 'pages'),
        '~components': join(this.options.srcDir, 'components')
      },
      modules: [
        join(this.options.rootDir, 'node_modules'),
        nodeModulesDir
      ]
    },
    resolveLoader: {
      modules: [
        join(this.options.rootDir, 'node_modules'),
        nodeModulesDir
      ]
    },
    module: {
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
            presets: ['vue-app'],
            babelrc: false,
            cacheDirectory: !!this.options.dev
          })
        },
        { test: /\.css$/, use: styleLoader.call(this, 'css') },
        { test: /\.less$/, use: styleLoader.call(this, 'less', 'less-loader') },
        { test: /\.sass$/, use: styleLoader.call(this, 'sass', 'sass-loader?indentedSyntax&sourceMap') },
        { test: /\.scss$/, use: styleLoader.call(this, 'sass', 'sass-loader?sourceMap') },
        { test: /\.styl(us)?$/, use: styleLoader.call(this, 'stylus', 'stylus-loader') }
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
  // Add nuxt build loaders (can be configured in nuxt.config.js)
  config.module.rules = config.module.rules.concat(this.options.build.loaders)
  // Return config
  return config
}
