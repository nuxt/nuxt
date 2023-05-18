import querystring from 'node:querystring'
import { resolve } from 'pathe'
import webpack from 'webpack'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import { logger } from '@nuxt/kit'
import { joinURL } from 'ufo'
import ForkTSCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'

import type { WebpackConfigContext } from '../utils/config'
import { applyPresets } from '../utils/config'
import { nuxt } from '../presets/nuxt'

export function client (ctx: WebpackConfigContext) {
  ctx.name = 'client'
  ctx.isClient = true

  applyPresets(ctx, [
    nuxt,
    clientPlugins,
    clientOptimization,
    clientDevtool,
    clientPerformance,
    clientHMR
  ])
}

function clientDevtool (ctx: WebpackConfigContext) {
  if (!ctx.nuxt.options.sourcemap.client) {
    ctx.config.devtool = false
    return
  }

  if (!ctx.isDev) {
    ctx.config.devtool = 'source-map'
    return
  }

  ctx.config.devtool = 'eval-cheap-module-source-map'
}

function clientPerformance (ctx: WebpackConfigContext) {
  ctx.config.performance = {
    maxEntrypointSize: 1000 * 1024,
    hints: ctx.isDev ? false : 'warning',
    ...ctx.config.performance
  }
}

function clientHMR (ctx: WebpackConfigContext) {
  const { options, config } = ctx

  if (!ctx.isDev) {
    return
  }

  const clientOptions = options.webpack.hotMiddleware?.client || {}
  const hotMiddlewareClientOptions = {
    reload: true,
    timeout: 30000,
    path: joinURL(options.app.baseURL, '__webpack_hmr', ctx.name),
    ...clientOptions,
    ansiColors: JSON.stringify(clientOptions.ansiColors || {}),
    overlayStyles: JSON.stringify(clientOptions.overlayStyles || {}),
    name: ctx.name
  }
  const hotMiddlewareClientOptionsStr = querystring.stringify(hotMiddlewareClientOptions)

  // Add HMR support
  const app = (config.entry as any).app as any
  app.unshift(
    // https://github.com/glenjamin/webpack-hot-middleware#config
    `webpack-hot-middleware/client?${hotMiddlewareClientOptionsStr}`
  )

  config.plugins = config.plugins || []
  config.plugins.push(new webpack.HotModuleReplacementPlugin())
}

function clientOptimization (_ctx: WebpackConfigContext) {
  // TODO: Improve optimization.splitChunks.cacheGroups
}

function clientPlugins (ctx: WebpackConfigContext) {
  const { options, config } = ctx

  // webpack Bundle Analyzer
  // https://github.com/webpack-contrib/webpack-bundle-analyzer
  if (!ctx.isDev && ctx.name === 'client' && options.webpack.analyze) {
    const statsDir = resolve(options.analyzeDir)

    config.plugins!.push(new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      defaultSizes: 'gzip',
      generateStatsFile: true,
      openAnalyzer: true,
      reportFilename: resolve(statsDir, `${ctx.name}.html`),
      statsFilename: resolve(statsDir, `${ctx.name}.json`),
      ...options.webpack.analyze === true ? {} : options.webpack.analyze
    }))
  }

  // Normally type checking runs in server config, but in `ssr: false` there is
  // no server build, so we inject here instead.
  if (!ctx.nuxt.options.ssr) {
    if (ctx.nuxt.options.typescript.typeCheck === true || (ctx.nuxt.options.typescript.typeCheck === 'build' && !ctx.nuxt.options.dev)) {
      config.plugins!.push(new ForkTSCheckerWebpackPlugin({
        logger
      }))
    }
  }
}
