import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin'
import type { WebpackConfigContext } from '../utils/config'
import { fileName, applyPresets } from '../utils/config'
import { getPostcssConfig } from '../utils/postcss'

export function style (ctx: WebpackConfigContext) {
  applyPresets(ctx, [
    loaders,
    extractCSS,
    minimizer
  ])
}

function minimizer (ctx: WebpackConfigContext) {
  const { options, config } = ctx

  if (options.webpack.optimizeCSS && Array.isArray(config.optimization!.minimizer)) {
    config.optimization!.minimizer.push(new CssMinimizerPlugin({
      ...options.webpack.optimizeCSS
    }))
  }
}

function extractCSS (ctx: WebpackConfigContext) {
  const { options, config } = ctx

  // CSS extraction
  if (options.webpack.extractCSS) {
    config.plugins!.push(new MiniCssExtractPlugin({
      filename: fileName(ctx, 'css'),
      chunkFilename: fileName(ctx, 'css'),
      ...options.webpack.extractCSS === true ? {} : options.webpack.extractCSS
    }))
  }
}

function loaders (ctx: WebpackConfigContext) {
  const { config, options } = ctx

  // CSS
  config.module!.rules!.push(createdStyleRule('css', /\.css$/i, null, ctx))

  // PostCSS
  config.module!.rules!.push(createdStyleRule('postcss', /\.p(ost)?css$/i, null, ctx))

  // Less
  const lessLoader = { loader: 'less-loader', options: options.webpack.loaders.less }
  config.module!.rules!.push(createdStyleRule('less', /\.less$/i, lessLoader, ctx))

  // Sass (TODO: optional dependency)
  const sassLoader = { loader: 'sass-loader', options: options.webpack.loaders.sass }
  config.module!.rules!.push(createdStyleRule('sass', /\.sass$/i, sassLoader, ctx))

  const scssLoader = { loader: 'sass-loader', options: options.webpack.loaders.scss }
  config.module!.rules!.push(createdStyleRule('scss', /\.scss$/i, scssLoader, ctx))

  // Stylus
  const stylusLoader = { loader: 'stylus-loader', options: options.webpack.loaders.stylus }
  config.module!.rules!.push(createdStyleRule('stylus', /\.styl(us)?$/i, stylusLoader, ctx))
}

function createdStyleRule (lang: string, test: RegExp, processorLoader: any, ctx: WebpackConfigContext) {
  const { options } = ctx

  const styleLoaders = [
    createPostcssLoadersRule(ctx),
    processorLoader
  ].filter(Boolean)

  options.webpack.loaders.css.importLoaders =
    options.webpack.loaders.cssModules.importLoaders =
    styleLoaders.length

  const cssLoaders = createCssLoadersRule(ctx, options.webpack.loaders.css)
  const cssModuleLoaders = createCssLoadersRule(ctx, options.webpack.loaders.cssModules)

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

function createCssLoadersRule (ctx: WebpackConfigContext, cssLoaderOptions: any) {
  const { options } = ctx

  const cssLoader = { loader: 'css-loader', options: cssLoaderOptions }

  if (options.webpack.extractCSS) {
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
    //   loader: 'vue-style-loader',
    //   options: options.webpack.loaders.vueStyle
    // },
    cssLoader
  ]
}

function createPostcssLoadersRule (ctx: WebpackConfigContext) {
  const { options, nuxt } = ctx

  if (!options.postcss) { return }

  const config = getPostcssConfig(nuxt)

  if (!config) {
    return
  }

  return {
    loader: 'postcss-loader',
    options: config
  }
}
