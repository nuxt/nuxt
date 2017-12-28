const webpack = require('webpack')
const VueSSRServerPlugin = require('vue-server-renderer/server-plugin')
const nodeExternals = require('webpack-node-externals')
const { each } = require('lodash')
const { resolve } = require('path')
const { existsSync } = require('fs')
const base = require('./base.config.js')

/*
|--------------------------------------------------------------------------
| Webpack Server Config
|--------------------------------------------------------------------------
*/
module.exports = function webpackServerConfig() {
  let config = base.call(this, { name: 'server', isServer: true })

  // env object defined in nuxt.config.js
  let env = {}
  each(this.options.env, (value, key) => {
    env['process.env.' + key] = (['boolean', 'number'].indexOf(typeof value) !== -1 ? value : JSON.stringify(value))
  })

  config = Object.assign(config, {
    target: 'node',
    node: false,
    devtool: 'source-map',
    entry: resolve(this.options.buildDir, 'server.js'),
    output: Object.assign({}, config.output, {
      filename: 'server-bundle.js',
      libraryTarget: 'commonjs2'
    }),
    performance: {
      hints: false,
      maxAssetSize: Infinity
    },
    externals: [],
    plugins: (config.plugins || []).concat([
      new VueSSRServerPlugin({
        filename: 'server-bundle.json'
      }),
      new webpack.DefinePlugin(Object.assign(env, {
        'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV || (this.options.dev ? 'development' : 'production')),
        'process.env.VUE_ENV': JSON.stringify('server'),
        'process.mode': JSON.stringify(this.options.mode),
        'process.browser': false,
        'process.client': false,
        'process.server': true,
        'process.static': this.isStatic
      }))
    ])
  })

  // https://webpack.js.org/configuration/externals/#externals
  // https://github.com/liady/webpack-node-externals
  this.options.modulesDir.forEach(dir => {
    if (existsSync(dir)) {
      config.externals.push(nodeExternals({
        // load non-javascript files with extensions, presumably via loaders
        whitelist: [/es6-promise|\.(?!(?:js|json)$).{1,5}$/i],
        modulesDir: dir
      }))
    }
  })

  // Extend config
  if (typeof this.options.build.extend === 'function') {
    const isDev = this.options.dev
    const extendedConfig = this.options.build.extend.call(this, config, {
      get dev() {
        console.warn('dev has been deprecated in build.extend(), please use isDev') // eslint-disable-line no-console
        return isDev
      },
      isDev,
      isServer: true
    })
    // Only overwrite config when something is returned for backwards compatibility
    if (extendedConfig !== undefined) {
      config = extendedConfig
    }
  }

  return config
}
