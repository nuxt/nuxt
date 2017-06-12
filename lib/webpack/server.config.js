import webpack from 'webpack'
import VueSSRServerPlugin from 'vue-server-renderer/server-plugin'
import nodeExternals from 'webpack-node-externals'
import { each } from 'lodash'
import { resolve } from 'path'
import base from './base.config.js'

/*
|--------------------------------------------------------------------------
| Webpack Server Config
|--------------------------------------------------------------------------
*/
export default function webpackServerConfig () {
  let config = base.call(this, { isServer: true })

  // env object defined in nuxt.config.js
  let env = {}
  each(this.options.env, (value, key) => {
    env['process.env.' + key] = (typeof value === 'string' ? JSON.stringify(value) : value)
  })

  config = Object.assign(config, {
    target: 'node',
    devtool: (this.options.dev ? 'source-map' : false),
    entry: resolve(this.options.buildDir, 'server.js'),
    output: Object.assign({}, config.output, {
      path: resolve(this.options.buildDir, 'dist'),
      filename: 'server-bundle.js',
      libraryTarget: 'commonjs2'
    }),
    performance: {
      hints: false
    },
    externals: [
      nodeExternals({
        // load non-javascript files with extensions, presumably via loaders
        whitelist: [/\.(?!(?:js|json)$).{1,5}$/i]
      })
    ],
    plugins: (config.plugins || []).concat([
      new VueSSRServerPlugin({
        filename: 'server-bundle.json'
      }),
      new webpack.DefinePlugin(Object.assign(env, {
        'process.env.NODE_ENV': JSON.stringify(this.options.dev ? 'development' : 'production'),
        'process.BROWSER_BUILD': false, // deprecated
        'process.SERVER_BUILD': true,  // deprecated
        'process.browser': false,
        'process.server': true
      }))
    ])
  })
  // This is needed in webpack 2 for minifying CSS
  if (!this.options.dev) {
    config.plugins.push(
      new webpack.LoaderOptionsPlugin({
        minimize: true
      })
    )
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
