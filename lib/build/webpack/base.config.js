'use strict'

const vueLoaderConfig = require('./vue-loader.config')
const { defaults } = require('lodash')
const { join } = require('path')
const { urlJoin } = require('../../utils')

/*
|--------------------------------------------------------------------------
| Webpack Shared Config
|
| This is the config which is extended by the server and client
| webpack config files
|--------------------------------------------------------------------------
*/
module.exports = function () {
  const nodeModulesDir = join(__dirname, '..', '..', '..', 'node_modules')
  let config = {
    devtool: 'source-map',
    entry: {
      vendor: ['vue', 'vue-router', 'vue-meta', 'es6-promise', 'es6-object-assign']
    },
    output: {
      publicPath: urlJoin(this.options.router.base, '/_nuxt/')
    },
    resolve: {
      // Disable for now
      alias: {
        'static': join(this.dir, 'static'), // use in template with <img src="~static/nuxt.png" />
        '~static': join(this.dir, 'static'),
        'assets': join(this.dir, 'assets'), // use in template with <img src="~static/nuxt.png" />
        '~assets': join(this.dir, 'assets'),
        '~plugins': join(this.dir, 'plugins'),
        '~store': join(this.dir, 'store'),
        '~router': join(this.dir, '.nuxt/router'),
        '~pages': join(this.dir, 'pages'),
        '~components': join(this.dir, 'components')
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
          query: vueLoaderConfig.call(this)
        },
        {
          test: /\.js$/,
          loader: 'babel-loader',
          exclude: /node_modules/,
          query: defaults(this.options.build.babel, {
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
