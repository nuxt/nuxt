import path from 'path'
import querystring from 'querystring'
import webpack from 'webpack'
import HTMLPlugin from 'html-webpack-plugin'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import CorsPlugin from '../plugins/vue/cors'
import { applyPresets, WebpackConfigContext } from '../utils/config'
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
    clientHMR,
    clientHTML
  ])
}

function clientDevtool (ctx: WebpackConfigContext) {
  if (!ctx.isDev) {
    ctx.config.devtool = false
    return
  }

  const scriptPolicy = getCspScriptPolicy(ctx)
  const noUnsafeEval = scriptPolicy && !scriptPolicy.includes('\'unsafe-eval\'')
  ctx.config.devtool = noUnsafeEval
    ? 'cheap-module-source-map'
    : 'eval-cheap-module-source-map'
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

  const clientOptions = options.build.hotMiddleware?.client || {}
  const hotMiddlewareClientOptions = {
    reload: true,
    timeout: 30000,
    ansiColors: JSON.stringify(clientOptions.ansiColors || {}),
    overlayStyles: JSON.stringify(clientOptions.overlayStyles || {}),
    path: `${options.router.base}/__webpack_hmr/${ctx.name}`.replace(/\/\//g, '/'),
    ...clientOptions,
    name: ctx.name
  }
  const hotMiddlewareClientOptionsStr = querystring.stringify(hotMiddlewareClientOptions)

  // Add HMR support
  const app = (config.entry as any).app as any
  app.unshift(
      // https://github.com/glenjamin/webpack-hot-middleware#config
      `webpack-hot-middleware/client?${hotMiddlewareClientOptionsStr}`
  )

  config.plugins.push(new webpack.HotModuleReplacementPlugin())
}

function clientOptimization (ctx: WebpackConfigContext) {
  const { options, config } = ctx

  config.optimization = {
    ...config.optimization,
    ...options.build.optimization as any
  }

  // TODO: Improve optimization.splitChunks.cacheGroups
}

function clientHTML (ctx: WebpackConfigContext) {
  const { options, config } = ctx

  // Generate output HTML for SSR
  if (options.build.ssr) {
    config.plugins.push(
      new HTMLPlugin({
        filename: '../server/index.ssr.html',
        template: options.documentPath,
        minify: options.build.html.minify as any,
        inject: false // Resources will be injected using bundleRenderer
      })
    )
  }

  config.plugins.push(
    new HTMLPlugin({
      filename: '../server/index.spa.html',
      template: options.documentPath,
      minify: options.build.html.minify as any,
      inject: true
    })
  )
}

function clientPlugins (ctx: WebpackConfigContext) {
  const { options, config } = ctx

  // Webpack Bundle Analyzer
  // https://github.com/webpack-contrib/webpack-bundle-analyzer
  if (!ctx.isDev && options.build.analyze) {
    const statsDir = path.resolve(options.buildDir, 'stats')

    config.plugins.push(new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      defaultSizes: 'gzip',
      generateStatsFile: true,
      openAnalyzer: !options.build.quiet,
      reportFilename: path.resolve(statsDir, `${ctx.name}.html`),
      statsFilename: path.resolve(statsDir, `${ctx.name}.json`),
      ...options.build.analyze as any
    }))
  }

  // CORS
  if (ctx.options.render.crossorigin) {
    ctx.config.plugins.push(new CorsPlugin({
      crossorigin: ctx.options.render.crossorigin
    }))
  }
}

function getCspScriptPolicy (ctx: WebpackConfigContext) {
  const { csp } = ctx.options.render
  if (typeof csp === 'object') {
    const { policies = {} } = csp
    return policies['script-src'] || policies['default-src'] || []
  }
}
