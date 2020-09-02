import path from 'path'
import fs from 'fs'
import { ProvidePlugin } from 'webpack'
import nodeExternals from '../plugins/externals'
import { WebpackConfigContext, applyPresets, getWebpackConfig } from '../utils/config'
import { nuxt } from '../presets/nuxt'
import { node } from '../presets/node'

export function server (ctx: WebpackConfigContext) {
  ctx.name = 'server'
  ctx.isServer = true

  applyPresets(ctx, [
    nuxt,
    node,
    serverStandalone,
    serverPreset,
    serverPlugins
  ])

  return getWebpackConfig(ctx)
}

function serverPreset (ctx: WebpackConfigContext) {
  const { config } = ctx

  config.output.filename = 'server.js'
  config.devtool = 'cheap-module-source-map'

  config.optimization = {
    splitChunks: false,
    minimize: false
  }
}

function serverStandalone (ctx: WebpackConfigContext) {
  const { options, config } = ctx

  // https://webpack.js.org/configuration/externals/#externals
  // https://github.com/liady/webpack-node-externals
  // https://vue-loader.vuejs.org/migrating.html#ssr-externals
  if (!options.build.standalone) {
    options.modulesDir.forEach((dir) => {
      if (fs.existsSync(dir)) {
        (config.externals as any[]).push(
          nodeExternals({
            whitelist: [
              modulePath => !['.js', '.json', ''].includes(path.extname(modulePath)),
              ctx.transpile
            ],
            modulesDir: dir
          })
        )
      }
    })
  }
}

function serverPlugins (ctx: WebpackConfigContext) {
  const { config, options } = ctx

  // Server polyfills
  if (options.build.serverURLPolyfill) {
    config.plugins.push(new ProvidePlugin({
      URL: [options.build.serverURLPolyfill, 'URL'],
      URLSearchParams: [options.build.serverURLPolyfill, 'URLSearchParams']
    }))
  }
}
