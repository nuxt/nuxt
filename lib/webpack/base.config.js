'use strict'

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
export default function ({ isClient, isServer }) {
  const nodeModulesDir = join(__dirname, '..', 'node_modules')
  let config = {
    devtool: (this.dev ? 'cheap-module-source-map' : false),
    entry: {
      vendor: ['vue', 'vue-router', 'vue-meta']
    },
    output: {
      publicPath: (isUrl(this.options.build.publicPath) ? this.options.build.publicPath : urlJoin(this.options.router.base, this.options.build.publicPath))
    },
    performance: {
      maxEntrypointSize: 300000,
      maxAssetSize: 300000,
      hints: (this.dev ? false : 'warning')
    },
    resolve: {
      extensions: ['.js', '.json', '.vue'],
      // Disable for now
      alias: {
        '~': join(this.srcDir),
        'static': join(this.srcDir, 'static'), // use in template with <img src="~static/nuxt.png" />
        '~static': join(this.srcDir, 'static'),
        'assets': join(this.srcDir, 'assets'), // use in template with <img src="~assets/nuxt.png" />
        '~assets': join(this.srcDir, 'assets'),
        '~plugins': join(this.srcDir, 'plugins'),
        '~store': join(this.dir, '.nuxt/store'),
        '~router': join(this.dir, '.nuxt/router'),
        '~pages': join(this.srcDir, 'pages'),
        '~components': join(this.srcDir, 'components')
      },
      modules: [
        nodeModulesDir,
        join(this.dir, 'node_modules')
      ]
    },
    resolveLoader: {
      modules: [
        nodeModulesDir,
        join(this.dir, 'node_modules')
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
            cacheDirectory: !!this.dev
          })
        },
        { test: /\.css$/, use: styleLoader.call(this, 'css') },
        { test: /\.less$/, use: styleLoader.call(this, 'less', 'less-loader') },
        { test: /\.sass$/, use: styleLoader.call(this, 'sass', 'sass-loader?indentedSyntax') },
        { test: /\.scss$/, use: styleLoader.call(this, 'sass', 'sass-loader') },
        { test: /\.styl(us)?$/, use: styleLoader.call(this, 'stylus', 'stylus-loader') }
      ]
    },
    plugins: this.options.build.plugins
  }
  // CSS extraction
  if (extractStyles.call(this)) {
    config.plugins.push(
      new ExtractTextPlugin({filename: this.options.build.filenames.css})
    )
  }
  // Add nuxt build loaders (can be configured in nuxt.config.js)
  config.module.rules = config.module.rules.concat(this.options.build.loaders)
  // Return config
  return config
}
