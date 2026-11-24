import { logger } from '@nuxt/kit'
import type { WebpackConfigContext } from '../utils/config.ts'
import { applyPresets } from '../utils/config.ts'
import { getDevtool, shouldTypeCheck } from '../utils/options.ts'
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

  ctx.config.devtool = getDevtool(ctx.nuxt.options.sourcemap.server, ctx.isDev ? 'cheap-module-source-map' : 'source-map')

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

  if (ctx.userConfig.serverURLPolyfill) {
    ctx.config.plugins.push(new webpack.ProvidePlugin({
      URL: [ctx.userConfig.serverURLPolyfill, 'URL'],
      URLSearchParams: [ctx.userConfig.serverURLPolyfill, 'URLSearchParams'],
    }))
  }

  if (shouldTypeCheck(ctx.nuxt)) {
    ctx.config.plugins.push(new TsCheckerPlugin({ logger }))
  }
}
