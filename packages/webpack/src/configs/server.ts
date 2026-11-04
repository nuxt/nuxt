import { logger } from '@nuxt/kit'
import type { WebpackConfigContext } from '../utils/config.ts'
import { applyPresets } from '../utils/config.ts'
import { createServerExternals } from '../utils/server-externals.ts'
import { nuxt } from '../presets/nuxt.ts'
import { node } from '../presets/node.ts'
import { TsCheckerPlugin, webpack } from '../builder.ts'

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

export function serverPreset (ctx: WebpackConfigContext) {
  ctx.config.output!.filename = 'server.mjs'

  if (ctx.nuxt.options.sourcemap.server) {
    const prefix = ctx.nuxt.options.sourcemap.server === 'hidden' ? 'hidden-' : ''
    const nosources = ctx.nuxt.options.sourcemap.server === 'nosource' ? 'nosources-' : ''
    ctx.config.devtool = prefix + nosources + (ctx.isDev ? 'cheap-module-source-map' : 'source-map')
  } else {
    ctx.config.devtool = false
  }

  ctx.config.optimization = {
    splitChunks: false,
    minimize: false,
  }

  if (ctx.isDev) {
    ctx.config.output!.asyncChunks = false
  }
}

export function serverStandalone (ctx: WebpackConfigContext) {
  if (!Array.isArray(ctx.config.externals)) { return }
  ctx.config.externals.push(createServerExternals(ctx.nuxt))
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
