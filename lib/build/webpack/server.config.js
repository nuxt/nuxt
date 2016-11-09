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

  config = Object.assign(config, {
    target: 'node',
    devtool: false,
    entry: resolve(this.dir, '.nuxt', 'server.js'),
    output: Object.assign({}, base.output, {
      path: resolve(this.dir, '.nuxt', 'dist'),
      filename: 'server-bundle.js',
      libraryTarget: 'commonjs2'
    }),
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(this.dev ? 'development' : 'production'),
        'process.env.VUE_ENV': '"server"',
        'process.BROWSER': false
      })
    ]
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
