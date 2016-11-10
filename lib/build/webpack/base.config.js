'use strict'

const vueLoaderConfig = require('./vue-loader.config')
const { join } = require('path')

/*
|--------------------------------------------------------------------------
| Webpack Shared Config
|
| This is the config which is extented by the server and client
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
      publicPath: '/_nuxt/'
    },
    resolve: {
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
          loader: 'vue',
          options: vueLoaderConfig.call(this)
        },
        {
          test: /\.js$/,
          loader: 'babel',
          exclude: /node_modules/,
          options: {
            presets: ['es2015', 'stage-2']
          }
        }
      ]
    }
  }
  // Add nuxt build loaders (can be configured in nuxt.config.js)
  config.module.rules = config.module.rules.concat(this.options.build.loaders)

  // Return config
  return config
}
