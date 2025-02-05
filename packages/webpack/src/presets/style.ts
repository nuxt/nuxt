import CssMinimizerPlugin from 'css-minimizer-webpack-plugin'
import type { WebpackConfigContext } from '../utils/config'
import { applyPresets, fileName } from '../utils/config'
import { getPostcssConfig } from '../utils/postcss'

import { MiniCssExtractPlugin } from '#builder'

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
  // CSS extraction
  const filename = fileName(ctx, 'css')
  ctx.config.plugins!.push(new MiniCssExtractPlugin({
    filename,
    chunkFilename: filename,
    ...config === true ? {} : config,
  }))
}

async function loaders (ctx: WebpackConfigContext) {
  // CSS
  ctx.config.module!.rules!.push(await createdStyleRule('css', /\.css$/i, null, ctx))

  // PostCSS
  ctx.config.module!.rules!.push(await createdStyleRule('postcss', /\.p(ost)?css$/i, null, ctx))

  // Less
  const lessLoader = { loader: 'less-loader', options: ctx.userConfig.loaders.less }
  ctx.config.module!.rules!.push(await createdStyleRule('less', /\.less$/i, lessLoader, ctx))

  // Sass (TODO: optional dependency)
  const sassLoader = { loader: 'sass-loader', options: ctx.userConfig.loaders.sass }
  ctx.config.module!.rules!.push(await createdStyleRule('sass', /\.sass$/i, sassLoader, ctx))

  const scssLoader = { loader: 'sass-loader', options: ctx.userConfig.loaders.scss }
  ctx.config.module!.rules!.push(await createdStyleRule('scss', /\.scss$/i, scssLoader, ctx))

  // Stylus
  const stylusLoader = { loader: 'stylus-loader', options: ctx.userConfig.loaders.stylus }
  ctx.config.module!.rules!.push(await createdStyleRule('stylus', /\.styl(us)?$/i, stylusLoader, ctx))
}

async function createdStyleRule (lang: string, test: RegExp, processorLoader: any, ctx: WebpackConfigContext) {
  const styleLoaders = [
    await createPostcssLoadersRule(ctx),
    processorLoader,
  ].filter(Boolean)

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

  if (ctx.userConfig.extractCSS) {
    if (ctx.isServer) {
      // https://webpack.js.org/loaders/css-loader/#exportonlylocals
      if (cssLoader.options.modules) {
        cssLoader.options.modules.exportOnlyLocals = cssLoader.options.modules.exportOnlyLocals ?? true
      }
      return [cssLoader]
    }

    return [
      {
        loader: MiniCssExtractPlugin.loader,
      },
      cssLoader,
    ]
  }

  return [
    // https://github.com/vuejs/vue-style-loader/issues/56
    // {
    //   loader: 'vue-style-loader',
    //   options: options.webpack.loaders.vueStyle
    // },
    cssLoader,
  ]
}

async function createPostcssLoadersRule (ctx: WebpackConfigContext) {
  if (!ctx.options.postcss) { return }

  const config = await getPostcssConfig(ctx.nuxt)

  if (!config) {
    return
  }

  return {
    loader: 'postcss-loader',
    options: config,
  }
}
