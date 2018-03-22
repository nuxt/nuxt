import path from 'path'
import fs from 'fs'

import webpack from 'webpack'
import nodeExternals from 'webpack-node-externals'
import _ from 'lodash'

import base from './base.config'

// import VueSSRServerPlugin from 'vue-server-renderer/server-plugin'
import VueSSRServerPlugin from './plugins/vue/server'

/*
|--------------------------------------------------------------------------
| Webpack Server Config
|--------------------------------------------------------------------------
*/
export default function webpackServerConfig() {
  let config = base.call(this, { name: 'server', isServer: true })

  // Env object defined in nuxt.config.js
  let env = {}
  _.each(this.options.env, (value, key) => {
    env['process.env.' + key] =
      ['boolean', 'number'].indexOf(typeof value) !== -1
        ? value
        : JSON.stringify(value)
  })

  // Config devtool
  config.devtool = this.options.dev ? 'cheap-source-map' : false

  config = Object.assign(config, {
    target: 'node',
    node: false,
    entry: path.resolve(this.options.buildDir, 'server.js'),
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
      new webpack.DefinePlugin(
        Object.assign(env, {
          'process.env.VUE_ENV': JSON.stringify('server'),
          'process.mode': JSON.stringify(this.options.mode),
          'process.browser': false,
          'process.client': false,
          'process.server': true,
          'process.static': this.isStatic
        })
      )
    ])
  })

  // https://webpack.js.org/configuration/externals/#externals
  // https://github.com/liady/webpack-node-externals
  this.options.modulesDir.forEach(dir => {
    if (fs.existsSync(dir)) {
      config.externals.push(
        nodeExternals({
          // load non-javascript files with extensions, presumably via loaders
          whitelist: [/es6-promise|\.(?!(?:js|json)$).{1,5}$/i],
          modulesDir: dir
        })
      )
    }
  })

  // Extend config
  if (typeof this.options.build.extend === 'function') {
    const isDev = this.options.dev
    const extendedConfig = this.options.build.extend.call(this, config, {
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
