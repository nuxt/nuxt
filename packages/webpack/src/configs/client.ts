import querystring from 'node:querystring'
import { resolve } from 'pathe'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import { logger } from '@nuxt/kit'
import { joinURL } from 'ufo'
import { defineEnv } from 'unenv'

import type { WebpackConfigContext } from '../utils/config'
import { applyPresets } from '../utils/config'
import { nuxt } from '../presets/nuxt'
import { TsCheckerPlugin, webpack } from '#builder'

export async function client (ctx: WebpackConfigContext) {
  ctx.name = 'client'
  ctx.isClient = true

  await applyPresets(ctx, [
    nuxt,
    clientPlugins,
    clientOptimization,
    clientDevtool,
    clientPerformance,
    clientHMR,
    clientNodeCompat,
  ])
}

function clientDevtool (ctx: WebpackConfigContext) {
  if (!ctx.nuxt.options.sourcemap.client) {
    ctx.config.devtool = false
    return
  }

  const prefix = ctx.nuxt.options.sourcemap.client === 'hidden' ? 'hidden-' : ''

  if (!ctx.isDev) {
    ctx.config.devtool = prefix + 'source-map'
    return
  }

  ctx.config.devtool = prefix + 'eval-cheap-module-source-map'
}

function clientPerformance (ctx: WebpackConfigContext) {
  ctx.config.performance = {
    maxEntrypointSize: 1000 * 1024,
    hints: ctx.isDev ? false : 'warning',
    ...ctx.config.performance,
  }
}

function clientNodeCompat (ctx: WebpackConfigContext) {
  if (!ctx.nuxt.options.experimental.clientNodeCompat) {
    return
  }
  ctx.config.plugins!.push(new webpack.DefinePlugin({ global: 'globalThis' }))

  ctx.config.resolve ||= {}
  ctx.config.resolve.fallback = {
    ...defineEnv({
      nodeCompat: true,
      resolve: true,
    }).env.alias,
    ...ctx.config.resolve.fallback,
  }

  // https://github.com/webpack/webpack/issues/13290#issuecomment-1188760779
  ctx.config.plugins!.unshift(new webpack.NormalModuleReplacementPlugin(/node:/, (resource) => {
    resource.request = resource.request.replace(/^node:/, '')
  }))
}

function clientHMR (ctx: WebpackConfigContext) {
  if (!ctx.isDev) {
    return
  }

  const clientOptions = ctx.userConfig.hotMiddleware?.client || {}
  const hotMiddlewareClientOptions = {
    reload: true,
    timeout: 30000,
    path: joinURL(ctx.options.app.baseURL, '__webpack_hmr', ctx.name),
    ...clientOptions,
    ansiColors: JSON.stringify(clientOptions.ansiColors || {}),
    overlayStyles: JSON.stringify(clientOptions.overlayStyles || {}),
    name: ctx.name,
  }
  const hotMiddlewareClientOptionsStr = querystring.stringify(hotMiddlewareClientOptions)

  // Add HMR support
  const app = (ctx.config.entry as any).app as any
  app.unshift(
    // https://github.com/glenjamin/webpack-hot-middleware#config
    `webpack-hot-middleware/client?${hotMiddlewareClientOptionsStr}`,
  )

  ctx.config.plugins ||= []
  ctx.config.plugins.push(new webpack.HotModuleReplacementPlugin())
}

function clientOptimization (_ctx: WebpackConfigContext) {
  // TODO: Improve optimization.splitChunks.cacheGroups
}

function clientPlugins (ctx: WebpackConfigContext) {
  // webpack Bundle Analyzer
  // https://github.com/webpack-contrib/webpack-bundle-analyzer
  if (!ctx.isDev && !ctx.nuxt.options.test && ctx.name === 'client' && ctx.userConfig.analyze && (ctx.userConfig.analyze === true || ctx.userConfig.analyze.enabled)) {
    const statsDir = resolve(ctx.options.analyzeDir)

    ctx.config.plugins!.push(new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      defaultSizes: 'gzip',
      generateStatsFile: true,
      openAnalyzer: true,
      reportFilename: resolve(statsDir, `${ctx.name}.html`),
      statsFilename: resolve(statsDir, `${ctx.name}.json`),
      ...ctx.userConfig.analyze === true ? {} : ctx.userConfig.analyze,
    }))
  }

  // Normally type checking runs in server config, but in `ssr: false` there is
  // no server build, so we inject here instead.
  if (!ctx.nuxt.options.ssr) {
    if (!ctx.nuxt.options.test && (ctx.nuxt.options.typescript.typeCheck === true || (ctx.nuxt.options.typescript.typeCheck === 'build' && !ctx.nuxt.options.dev))) {
      ctx.config.plugins!.push(new TsCheckerPlugin({
        logger,
      }))
    }
  }
}
