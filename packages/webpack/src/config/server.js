import path from 'path'
import fs from 'fs'
import webpack from 'webpack'
import escapeRegExp from 'lodash/escapeRegExp'
import nodeExternals from 'webpack-node-externals'

import VueSSRServerPlugin from '../plugins/vue/server'

import WebpackBaseConfig from './base'

export default class WebpackServerConfig extends WebpackBaseConfig {
  constructor (...args) {
    super(...args)
    this.name = 'server'
    this.isServer = true
    this.whitelist = this.normalizeWhitelist()
  }

  normalizeWhitelist () {
    const whitelist = [
      /\.(?!js(x|on)?$)/i
    ]
    for (const pattern of this.buildContext.buildOptions.transpile) {
      if (pattern instanceof RegExp) {
        whitelist.push(pattern)
      } else {
        const posixModule = pattern.replace(/\\/g, '/')
        whitelist.push(new RegExp(escapeRegExp(posixModule)))
      }
    }

    return whitelist
  }

  get devtool () {
    return 'cheap-module-source-map'
  }

  env () {
    return Object.assign(super.env(), {
      'process.env.VUE_ENV': JSON.stringify('server'),
      'process.browser': false,
      'process.client': false,
      'process.server': true,
      'process.modern': false
    })
  }

  optimization () {
    return {
      splitChunks: false,
      minimizer: this.minimizer()
    }
  }

  resolve () {
    const resolveConfig = super.resolve()

    resolveConfig.resolve.mainFields = ['main', 'module']

    return resolveConfig
  }

  alias () {
    const aliases = super.alias()

    for (const p of this.buildContext.plugins) {
      if (!aliases[p.name]) {
        // Do not load client-side plugins on server-side
        aliases[p.name] = p.mode === 'client' ? './empty.js' : p.src
      }
    }

    return aliases
  }

  plugins () {
    const plugins = super.plugins()
    plugins.push(
      new VueSSRServerPlugin({
        filename: `${this.name}.manifest.json`
      }),
      new webpack.DefinePlugin(this.env())
    )
    return plugins
  }

  config () {
    const config = super.config()

    Object.assign(config, {
      target: 'node',
      node: false,
      entry: Object.assign({}, config.entry, {
        app: [path.resolve(this.buildContext.options.buildDir, 'server.js')]
      }),
      output: Object.assign({}, config.output, {
        filename: 'server.js',
        libraryTarget: 'commonjs2'
      }),
      performance: {
        hints: false,
        maxEntrypointSize: Infinity,
        maxAssetSize: Infinity
      },
      externals: [].concat(config.externals || [])
    })

    // https://webpack.js.org/configuration/externals/#externals
    // https://github.com/liady/webpack-node-externals
    // https://vue-loader.vuejs.org/migrating.html#ssr-externals
    if (!this.buildContext.buildOptions.standalone) {
      this.buildContext.options.modulesDir.forEach((dir) => {
        if (fs.existsSync(dir)) {
          config.externals.push(
            nodeExternals({
              whitelist: this.whitelist,
              modulesDir: dir
            })
          )
        }
      })
    }

    return config
  }
}
