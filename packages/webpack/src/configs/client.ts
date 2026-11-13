import querystring from 'node:querystring'
import { resolve } from 'pathe'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import { logger } from '@nuxt/kit'
import { joinURL } from 'ufo'
import { defineEnv } from 'unenv'

import type { WebpackConfigContext } from '../utils/config.ts'
import { applyPresets } from '../utils/config.ts'
import { getDevtool, getGlobalCSSCacheGroup, shouldTypeCheck } from '../utils/options.ts'
import { nuxt } from '../presets/nuxt.ts'
import { TsCheckerPlugin, builder, webpack } from '../builder.ts'

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

export function clientDevtool (ctx: WebpackConfigContext) {
  const sourcemap = ctx.nuxt.options.sourcemap.client
  if (!ctx.isDev) {
    ctx.config.devtool = getDevtool(sourcemap, 'source-map')
    return
  }
  const devtool = getDevtool(sourcemap, 'cheap-module-source-map')
  ctx.config.devtool = devtool && sourcemap !== 'hidden' ? `eval-${devtool}` : devtool
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

  ctx.config.plugins ||= []
  ctx.config.plugins.push(new webpack.HotModuleReplacementPlugin())

  // Rsbuild's dev server injects its own HMR client
  if (builder === 'rspack') {
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
    // https://github.com/webpack/webpack-hot-middleware#config
    `webpack-hot-middleware/client?${hotMiddlewareClientOptionsStr}`,
  )
}

function clientOptimization (ctx: WebpackConfigContext) {
  const nuxtGlobalCSS = getGlobalCSSCacheGroup(ctx.nuxt)
  if (nuxtGlobalCSS) {
    ctx.config.optimization ||= {}
    ctx.config.optimization.splitChunks ||= {}
    ctx.config.optimization.splitChunks.cacheGroups ||= {}
    ctx.config.optimization.splitChunks.cacheGroups.nuxtGlobalCSS = nuxtGlobalCSS
  }
}

function clientPlugins (ctx: WebpackConfigContext) {
  // webpack Bundle Analyzer
  // https://github.com/webpack/webpack-bundle-analyzer
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

  // type checking runs once, in the server build when SSR is enabled
  if (!ctx.nuxt.options.ssr && shouldTypeCheck(ctx.nuxt)) {
    ctx.config.plugins!.push(new TsCheckerPlugin({ logger }))
  }
}
