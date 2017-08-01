import webpack from 'webpack'
import VueSSRServerPlugin from 'vue-server-renderer/server-plugin'
import nodeExternals from 'webpack-node-externals'
import { each } from 'lodash'
import { resolve } from 'path'
import { existsSync } from 'fs'
import base from './base.config.js'

/*
|--------------------------------------------------------------------------
| Webpack Server Config
|--------------------------------------------------------------------------
*/
export default function webpackServerConfig () {
  let config = base.call(this, { isServer: true })

  config.name = 'server'

  // env object defined in nuxt.config.js
  let env = {}
  each(this.options.env, (value, key) => {
    env['process.env.' + key] = (typeof value === 'string' ? JSON.stringify(value) : value)
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
        'process.browser': false,
        'process.server': true
      }))
    ])
  })

  // https://webpack.js.org/configuration/externals/#externals
  // https://github.com/liady/webpack-node-externals
  if (existsSync(this.options.modulesDir)) {
    config.externals.push(nodeExternals({
      // load non-javascript files with extensions, presumably via loaders
      whitelist: [/\.(?!(?:js|json)$).{1,5}$/i],
      modulesDir: this.options.modulesDir
    }))
  }

  // --------------------------------------
  // Production specific config
  // --------------------------------------
  if (!this.options.dev) {

  }

  // Extend config
  if (typeof this.options.build.extend === 'function') {
    this.options.build.extend.call(this, config, {
      dev: this.options.dev,
      isServer: true
    })
  }

  return config
}
