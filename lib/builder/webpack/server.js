import path from 'path'
import fs from 'fs'

import webpack from 'webpack'
import nodeExternals from 'webpack-node-externals'

import BaseConfig from './base'
import VueSSRServerPlugin from './plugins/vue/server'

export default class WebpackServerConfig extends BaseConfig {
  constructor(builder) {
    super(builder, { name: 'server', isServer: true })
  }

  env() {
    return Object.assign(super.env(), {
      'process.env.VUE_ENV': JSON.stringify('server'),
      'process.browser': false,
      'process.client': false,
      'process.server': true
    })
  }

  plugins() {
    const plugins = super.plugins()
    plugins.push(
      new VueSSRServerPlugin({
        filename: 'server-bundle.json'
      }),
      new webpack.DefinePlugin(this.env())
    )
    return plugins
  }

  config() {
    const config = super.config()

    // Config devtool
    config.devtool = 'cheap-source-map'

    Object.assign(config, {
      target: 'node',
      node: false,
      entry: {
        app: [path.resolve(this.options.buildDir, 'server.js')]
      },
      output: Object.assign({}, config.output, {
        filename: 'server-bundle.js',
        libraryTarget: 'commonjs2'
      }),
      performance: {
        hints: false,
        maxAssetSize: Infinity
      },
      externals: [],
      optimization: {
        splitChunks: false,
        minimizer: []
      }
    })

    // https://webpack.js.org/configuration/externals/#externals
    // https://github.com/liady/webpack-node-externals
    // https://vue-loader.vuejs.org/migrating.html#ssr-externals
    this.options.modulesDir.forEach((dir) => {
      if (fs.existsSync(dir)) {
        config.externals.push(
          nodeExternals({
            whitelist: [
              /\.css$/,
              /\?vue&type=style/,
              ...this.options.build.transpile
            ],
            modulesDir: dir
          })
        )
      }
    })

    return this.customize(config)
  }
}
