import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin'
import { tryResolveModule } from '@nuxt/kit'
import type { WebpackConfigContext } from '../utils/config'
import { applyPresets, fileName } from '../utils/config'
import { getPostcssConfig } from '../utils/postcss'

export async function style (ctx: WebpackConfigContext) {
  await applyPresets(ctx, [
    loaders,
    extractCSS,
    minimizer
  ])
}

function minimizer (ctx: WebpackConfigContext) {
  if (ctx.userConfig.optimizeCSS && Array.isArray(ctx.config.optimization!.minimizer)) {
    ctx.config.optimization!.minimizer.push(new CssMinimizerPlugin({
      ...ctx.userConfig.optimizeCSS
    }))
  }
}

function extractCSS (ctx: WebpackConfigContext) {
  // CSS extraction
  if (ctx.userConfig.extractCSS) {
    ctx.config.plugins!.push(new MiniCssExtractPlugin({
      filename: fileName(ctx, 'css'),
      chunkFilename: fileName(ctx, 'css'),
      ...ctx.userConfig.extractCSS === true ? {} : ctx.userConfig.extractCSS
    }))
  }
}

async function loaders (ctx: WebpackConfigContext) {
  // CSS
  ctx.config.module!.rules!.push(await createdStyleRule('css', /\.css$/i, null, ctx))

  // PostCSS
  ctx.config.module!.rules!.push(await createdStyleRule('postcss', /\.p(ost)?css$/i, null, ctx))

  // Less
  const lessLoader = { loader: await tryResolveModule('less-loader', import.meta.url) ?? 'less-loader', options: ctx.userConfig.loaders.less }
  ctx.config.module!.rules!.push(await createdStyleRule('less', /\.less$/i, lessLoader, ctx))

  // Sass (TODO: optional dependency)
  const sassLoader = { loader: await tryResolveModule('sass-loader', import.meta.url) ?? 'sass-loader', options: ctx.userConfig.loaders.sass }
  ctx.config.module!.rules!.push(await createdStyleRule('sass', /\.sass$/i, sassLoader, ctx))

  const scssLoader = { loader: await tryResolveModule('sass-loader', import.meta.url) ?? 'sass-loader', options: ctx.userConfig.loaders.scss }
  ctx.config.module!.rules!.push(await createdStyleRule('scss', /\.scss$/i, scssLoader, ctx))

  // Stylus
  const stylusLoader = { loader: await tryResolveModule('stylus-loader', import.meta.url) ?? 'stylus-loader', options: ctx.userConfig.loaders.stylus }
  ctx.config.module!.rules!.push(await createdStyleRule('stylus', /\.styl(us)?$/i, stylusLoader, ctx))
}

async function createdStyleRule (lang: string, test: RegExp, processorLoader: any, ctx: WebpackConfigContext) {
  const styleLoaders = [
    await createPostcssLoadersRule(ctx),
    processorLoader
  ].filter(Boolean)

  ctx.userConfig.loaders.css.importLoaders =
    ctx.userConfig.loaders.cssModules.importLoaders =
    styleLoaders.length

  const cssLoaders = await createCssLoadersRule(ctx, ctx.userConfig.loaders.css)
  const cssModuleLoaders = await createCssLoadersRule(ctx, ctx.userConfig.loaders.cssModules)

  return {
    test,
    oneOf: [
      // This matches <style module>
      {
        resourceQuery: /module/,
        use: cssModuleLoaders.concat(styleLoaders)
      },
      // This matches plain <style> or <style scoped>
      {
        use: cssLoaders.concat(styleLoaders)
      }
    ]
  }
}

async function createCssLoadersRule (ctx: WebpackConfigContext, cssLoaderOptions: any) {
  const cssLoader = { loader: await tryResolveModule('css-loader', import.meta.url) ?? 'css-loader', options: cssLoaderOptions }

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
        loader: MiniCssExtractPlugin.loader
      },
      cssLoader
    ]
  }

  return [
    // https://github.com/vuejs/vue-style-loader/issues/56
    // {
    //   loader: await tryResolveModule('vue-style-loader', import.meta.url) ?? 'vue-style-loader',
    //   options: options.webpack.loaders.vueStyle
    // },
    cssLoader
  ]
}

async function createPostcssLoadersRule (ctx: WebpackConfigContext) {
  if (!ctx.options.postcss) { return }

  const config = getPostcssConfig(ctx.nuxt)

  if (!config) {
    return
  }

  return {
    loader: await tryResolveModule('postcss-loader', import.meta.url) ?? 'postcss-loader',
    options: config
  }
}
