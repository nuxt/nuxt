import { isAbsolute } from 'pathe'
import webpack from 'webpack'
import ForkTSCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'
import { logger } from '@nuxt/kit'
import type { WebpackConfigContext } from '../utils/config'
import { applyPresets, getWebpackConfig } from '../utils/config'
import { nuxt } from '../presets/nuxt'
import { node } from '../presets/node'

const assetPattern = /\.(css|s[ca]ss|png|jpe?g|gif|svg|woff2?|eot|ttf|otf|webp|webm|mp4|ogv)(\?.*)?$/i

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

  config.output!.filename = 'server.mjs'

  config.devtool = ctx.nuxt.options.sourcemap.server ? ctx.isDev ? 'cheap-module-source-map' : 'source-map' : false

  config.optimization = {
    splitChunks: false,
    minimize: false
  }
}

function serverStandalone (ctx: WebpackConfigContext) {
  // TODO: Refactor this out of webpack
  const inline = [
    'src/',
    '#app',
    'nuxt',
    'nuxt3',
    '!',
    '-!',
    '~',
    '@/',
    '#',
    ...ctx.options.build.transpile
  ]
  const external = ['#internal/nitro']

  if (!Array.isArray(ctx.config.externals)) { return }
  ctx.config.externals.push(({ request }, cb) => {
    if (!request) {
      return cb(undefined, false)
    }
    if (external.includes(request)) {
      return cb(undefined, true)
    }
    if (
      request[0] === '.' ||
      isAbsolute(request) ||
      inline.find(prefix => typeof prefix === 'string' && request.startsWith(prefix)) ||
      assetPattern.test(request)
    ) {
      // console.log('Inline', request)
      return cb(undefined, false)
    }
    // console.log('Ext', request)
    return cb(undefined, true)
  })
}

function serverPlugins (ctx: WebpackConfigContext) {
  const { config, options } = ctx

  config.plugins = config.plugins || []

  // Server polyfills
  if (options.webpack.serverURLPolyfill) {
    config.plugins.push(new webpack.ProvidePlugin({
      URL: [options.webpack.serverURLPolyfill, 'URL'],
      URLSearchParams: [options.webpack.serverURLPolyfill, 'URLSearchParams']
    }))
  }

  // Add type-checking
  if (ctx.nuxt.options.typescript.typeCheck === true || (ctx.nuxt.options.typescript.typeCheck === 'build' && !ctx.nuxt.options.dev)) {
    config.plugins.push(new ForkTSCheckerWebpackPlugin({ logger }))
  }
}
