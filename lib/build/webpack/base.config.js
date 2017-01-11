'use strict'

import vueLoaderConfig from './vue-loader.config'
import { defaults } from 'lodash'
import { join } from 'path'
import { urlJoin } from '../../utils'

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
    devtool: 'source-map',
    entry: {
      vendor: ['vue', 'vue-router', 'vue-meta']
    },
    output: {
      publicPath: urlJoin(this.options.router.base, '/_nuxt/')
    },
    performance: {
      hints: (this.dev ? false : 'warning')
    },
    resolve: {
      extensions: ['.js', '.json', '.vue'],
      // Disable for now
      alias: {
        '~': join(this.srcDir),
        'static': join(this.srcDir, 'static'), // use in template with <img src="~static/nuxt.png" />
        '~static': join(this.srcDir, 'static'),
        'assets': join(this.srcDir, 'assets'), // use in template with <img src="~static/nuxt.png" />
        '~assets': join(this.srcDir, 'assets'),
        '~plugins': join(this.srcDir, 'plugins'),
        '~store': join(this.srcDir, 'store'),
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
            plugins: [
              'transform-async-to-generator',
              'transform-runtime'
            ],
            presets: [
              ['es2015', { modules: false }],
              'stage-2'
            ],
            cacheDirectory: !!this.dev
          })
        }
      ]
    },
    plugins: this.options.build.plugins
  }
  // Add nuxt build loaders (can be configured in nuxt.config.js)
  config.module.rules = config.module.rules.concat(this.options.build.loaders)
  // Return config
  return config
}
