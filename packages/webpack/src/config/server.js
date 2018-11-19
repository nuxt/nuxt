import path from 'path'
import fs from 'fs'
import webpack from 'webpack'
import escapeRegExp from 'lodash/escapeRegExp'
import nodeExternals from 'webpack-node-externals'

import WebpackBaseConfig from './base'
import VueSSRServerPlugin from './plugins/vue/server'

export default class WebpackServerConfig extends WebpackBaseConfig {
  constructor(builder) {
    super(builder, { name: 'server', isServer: true })
    this.whitelist = this.normalizeWhitelist()
  }

  normalizeWhitelist() {
    const whitelist = [
      /\.css$/,
      /\?vue&type=style/
    ]
    for (const pattern of this.options.build.transpile) {
      if (pattern instanceof RegExp) {
        whitelist.push(pattern)
      } else {
        const posixModule = pattern.replace(/\\/g, '/')
        whitelist.push(new RegExp(escapeRegExp(posixModule)))
      }
    }
    return whitelist
  }

  devtool() {
    return 'cheap-module-inline-source-map'
  }

  env() {
    return Object.assign(super.env(), {
      'process.env.VUE_ENV': JSON.stringify('server'),
      'process.browser': false,
      'process.client': false,
      'process.server': true
    })
  }

  optimization() {
    return {
      splitChunks: false,
      minimizer: []
    }
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
      externals: []
    })

    // https://webpack.js.org/configuration/externals/#externals
    // https://github.com/liady/webpack-node-externals
    // https://vue-loader.vuejs.org/migrating.html#ssr-externals
    this.options.modulesDir.forEach((dir) => {
      if (fs.existsSync(dir)) {
        config.externals.push(
          nodeExternals({
            whitelist: this.whitelist,
            modulesDir: dir
          })
        )
      }
    })

    return config
  }
}
