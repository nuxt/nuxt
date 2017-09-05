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
  let config = base.call(this, 'server')

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
        'process.server': true,
        'process.static': this.isStatic
      }))
    ])
  })

  // https://webpack.js.org/configuration/externals/#externals
  // https://github.com/liady/webpack-node-externals
  const moduleDirs = [
    this.options.modulesDir
    // Temporary disabled due to vue-server-renderer module search limitations
    // resolve(__dirname, '..', 'node_modules')
  ]
  moduleDirs.forEach(dir => {
    if (existsSync(dir)) {
      config.externals.push(nodeExternals({
        // load non-javascript files with extensions, presumably via loaders
        whitelist: [/es6-promise|\.(?!(?:js|json)$).{1,5}$/i],
        modulesDir: dir
      }))
    }
  })

  // --------------------------------------
  // Production specific config
  // --------------------------------------
  if (!this.options.dev) {

  }

  // Extend config
  if (typeof this.options.build.extend === 'function') {
    const extendedConfig = this.options.build.extend.call(this, config, {
      dev: this.options.dev,
      isServer: true
    })
    // Only overwrite config when something is returned for backwards compatibility
    if (extendedConfig !== undefined) {
      config = extendedConfig
    }
  }

  return config
}
