import path from 'path'
import fs from 'fs'
import { DefinePlugin, ProvidePlugin } from 'webpack'
import nodeExternals from 'webpack-node-externals'

import VueSSRServerPlugin from '../plugins/vue/server'

import WebpackBaseConfig from './base'

const nativeFileExtensions = [
  '.json',
  '.cjs',
  '.mjs',
  '.js'
]

export default class WebpackServerConfig extends WebpackBaseConfig {
  constructor (...args) {
    super(...args)
    this.name = 'server'
    this.isServer = true
  }

  get devtool () {
    return 'cheap-module-source-map'
  }

  get externalsAllowlist () {
    return [
      this.isNonNativeImport.bind(this),
      ...this.normalizeTranspile()
    ]
  }

  /**
   * files *not* ending on js|json should be processed by webpack
   *
   * this might generate false-positives for imports like
   * - "someFile.umd" (actually requiring someFile.umd.js)
   * - "some.folder" (some.folder being a directory containing a package.json)
   */
  isNonNativeImport (modulePath) {
    const extname = path.extname(modulePath)
    return extname !== '' && !nativeFileExtensions.includes(extname)
  }

  env () {
    return Object.assign(
      super.env(),
      {
        'process.env.VUE_ENV': JSON.stringify('server'),
        'process.browser': false,
        'process.client': false,
        'process.server': true,
        'process.modern': false
      }
    )
  }

  optimization () {
    const { _minifyServer } = this.buildContext.buildOptions

    return {
      splitChunks: false,
      minimizer: _minifyServer ? this.minimizer() : []
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
      new VueSSRServerPlugin({ filename: `${this.name}.manifest.json` }),
      new DefinePlugin(this.env())
    )

    const { serverURLPolyfill } = this.buildContext.options.build

    if (serverURLPolyfill) {
      plugins.push(new ProvidePlugin({
        URL: [serverURLPolyfill, 'URL'],
        URLSearchParams: [serverURLPolyfill, 'URLSearchParams']
      }))
    }

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
        chunkFilename: '[name].js',
        libraryTarget: 'commonjs2'
      }),
      performance: {
        hints: false,
        maxEntrypointSize: Infinity,
        maxAssetSize: Infinity
      },
      externals: ['node-fetch-native'].concat(config.externals || [])
    })

    // https://webpack.js.org/configuration/externals/#externals
    // https://github.com/liady/webpack-node-externals
    // https://vue-loader.vuejs.org/migrating.html#ssr-externals
    if (!this.buildContext.buildOptions.standalone) {
      this.buildContext.options.modulesDir.forEach((dir) => {
        if (fs.existsSync(dir)) {
          config.externals.push(
            nodeExternals({
              allowlist: this.externalsAllowlist,
              modulesDir: dir
            })
          )
        }
      })
    }

    return config
  }
}
