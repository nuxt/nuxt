import { isAbsolute, resolve } from 'pathe'
import { logger } from '@nuxt/kit'
import type { WebpackConfigContext } from '../utils/config'
import { applyPresets } from '../utils/config'
import { nuxt } from '../presets/nuxt'
import { node } from '../presets/node'
import { TsCheckerPlugin, webpack } from '#builder'

const assetPattern = /\.(?:css|s[ca]ss|png|jpe?g|gif|svg|woff2?|eot|ttf|otf|webp|webm|mp4|ogv)(?:\?.*)?$/i

export async function server (ctx: WebpackConfigContext) {
  ctx.name = 'server'
  ctx.isServer = true

  await applyPresets(ctx, [
    nuxt,
    node,
    serverStandalone,
    serverPreset,
    serverPlugins,
  ])
}

function serverPreset (ctx: WebpackConfigContext) {
  ctx.config.output!.filename = 'server.mjs'

  if (ctx.nuxt.options.sourcemap.server) {
    const prefix = ctx.nuxt.options.sourcemap.server === 'hidden' ? 'hidden-' : ''
    ctx.config.devtool = prefix + ctx.isDev ? 'cheap-module-source-map' : 'source-map'
  } else {
    ctx.config.devtool = false
  }

  ctx.config.optimization = {
    splitChunks: false,
    minimize: false,
  }
}

function serverStandalone (ctx: WebpackConfigContext) {
  // TODO: Refactor this out of webpack
  const inline = [
    'src/',
    '#app',
    'nuxt',
    'nuxt3',
    'nuxt-nightly',
    '!',
    '-!',
    '~',
    '@/',
    '#',
    ...ctx.options.build.transpile,
  ]
  const external = new Set([
    'nitro/runtime',
    '#shared',
    resolve(ctx.nuxt.options.rootDir, ctx.nuxt.options.dir.shared),
  ])
  if (!ctx.nuxt.options.dev) {
    external.add('#internal/nuxt/paths')
    external.add('#internal/nuxt/app-config')
    external.add('#app-manifest')
  }

  if (!Array.isArray(ctx.config.externals)) { return }
  ctx.config.externals.push(({ request }, cb) => {
    if (!request) {
      return cb(undefined, false)
    }
    if (external.has(request)) {
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
  ctx.config.plugins ||= []

  // Server polyfills
  if (ctx.userConfig.serverURLPolyfill) {
    ctx.config.plugins.push(new webpack.ProvidePlugin({
      URL: [ctx.userConfig.serverURLPolyfill, 'URL'],
      URLSearchParams: [ctx.userConfig.serverURLPolyfill, 'URLSearchParams'],
    }))
  }

  // Add type-checking
  if (!ctx.nuxt.options.test && (ctx.nuxt.options.typescript.typeCheck === true || (ctx.nuxt.options.typescript.typeCheck === 'build' && !ctx.nuxt.options.dev))) {
    ctx.config.plugins!.push(new TsCheckerPlugin({
      logger,
    }))
  }
}
