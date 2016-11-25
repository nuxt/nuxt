'use strict'

const _ = require('lodash')
const webpack = require('webpack')
const base = require('./base.config')
const { uniq } = require('lodash')
const { existsSync } = require('fs')
const { resolve } = require('path')

/*
|--------------------------------------------------------------------------
| Webpack Server Config
|--------------------------------------------------------------------------
*/
module.exports = function () {
  let config = base.call(this)

  // env object defined in nuxt.config.js
  let env = {}
  _.each(this.options.env, (value, key) => {
    env['process.env.' + key] = (typeof value === 'string' ? JSON.stringify(value) : value)
  })

  config = Object.assign(config, {
    target: 'node',
    devtool: false,
    entry: resolve(this.dir, '.nuxt', 'server.js'),
    output: Object.assign({}, config.output, {
      path: resolve(this.dir, '.nuxt', 'dist'),
      filename: 'server-bundle.js',
      libraryTarget: 'commonjs2'
    }),
    plugins: (config.plugins || []).concat([
      new webpack.DefinePlugin(Object.assign(env, {
        'process.env.NODE_ENV': JSON.stringify(this.dev ? 'development' : 'production'),
        'process.BROWSER_BUILD': false,
        'process.SERVER_BUILD': true
      }))
    ])
  })

  // Externals
  const nuxtPackageJson = require(resolve(__dirname, '..', '..', '..', 'package.json'))
  const projectPackageJson = resolve(this.dir, 'package.json')
  config.externals = Object.keys(nuxtPackageJson.dependencies || {})
  if (existsSync(projectPackageJson)) {
    config.externals = config.externals.concat(Object.keys(require(projectPackageJson).dependencies || {}))
  }
  config.externals = uniq(config.externals)

  // Return config
  return config
}
