import CssMinimizerPlugin from 'css-minimizer-webpack-plugin'
import type { WebpackConfigContext } from '../utils/config.ts'
import { applyPresets, fileName } from '../utils/config.ts'
import { getPostcssConfig } from '../utils/postcss.ts'

import { MiniCssExtractPlugin } from '../builder.ts'

export async function style (ctx: WebpackConfigContext) {
  await applyPresets(ctx, [
    loaders,
    extractCSS,
    minimizer,
  ])
}

function minimizer (ctx: WebpackConfigContext) {
  if (ctx.userConfig.optimizeCSS && Array.isArray(ctx.config.optimization!.minimizer)) {
    ctx.config.optimization!.minimizer.push(new CssMinimizerPlugin({
      ...ctx.userConfig.optimizeCSS,
    }))
  }
}

function extractCSS (ctx: WebpackConfigContext) {
  const config = ctx.userConfig.extractCSS
  if (!config) { return }
  const filename = fileName(ctx, 'css')
  ctx.config.plugins!.push(new MiniCssExtractPlugin({
    filename,
    chunkFilename: filename,
    ...config === true ? {} : config,
  }))
}

async function loaders (ctx: WebpackConfigContext) {
  const { loaders } = ctx.userConfig
  const rules = [
    [/\.css$/i],
    [/\.p(ost)?css$/i],
    [/\.less$/i, { loader: 'less-loader', options: loaders.less }],
    [/\.sass$/i, { loader: 'sass-loader', options: loaders.sass }],
    [/\.scss$/i, { loader: 'sass-loader', options: loaders.scss }],
    [/\.styl(us)?$/i, { loader: 'stylus-loader', options: loaders.stylus }],
  ] as const
  for (const [test, processorLoader] of rules) {
    ctx.config.module!.rules!.push(await createStyleRule(test, processorLoader, ctx))
  }
}

interface Loader { loader: string, options?: any }

async function createStyleRule (test: RegExp, processorLoader: Loader | undefined, ctx: WebpackConfigContext) {
  const styleLoaders = [
    await createPostcssLoadersRule(ctx),
    processorLoader,
  ].filter((loader): loader is Loader => !!loader)

  ctx.userConfig.loaders.css.importLoaders =
    ctx.userConfig.loaders.cssModules.importLoaders =
      styleLoaders.length

  const cssLoaders = createCssLoadersRule(ctx, ctx.userConfig.loaders.css)
  const cssModuleLoaders = createCssLoadersRule(ctx, ctx.userConfig.loaders.cssModules)

  return {
    test,
    oneOf: [
      // This matches <style module>
      {
        resourceQuery: /module/,
        use: cssModuleLoaders.concat(styleLoaders),
      },
      // This matches plain <style> or <style scoped>
      {
        use: cssLoaders.concat(styleLoaders),
      },
    ],
  }
}

function createCssLoadersRule (ctx: WebpackConfigContext, cssLoaderOptions: any) {
  const cssLoader = { loader: 'css-loader', options: cssLoaderOptions }

  if (!ctx.userConfig.extractCSS) {
    return [cssLoader]
  }

  if (ctx.isServer) {
    // https://webpack.js.org/loaders/css-loader/#exportonlylocals
    if (cssLoader.options.modules) {
      cssLoader.options.modules.exportOnlyLocals ??= true
    }
    return [cssLoader]
  }

  return [{ loader: MiniCssExtractPlugin.loader }, cssLoader]
}

async function createPostcssLoadersRule (ctx: WebpackConfigContext) {
  const config = await getPostcssConfig(ctx.nuxt)
  return config ? { loader: 'postcss-loader', options: config } : undefined
}
