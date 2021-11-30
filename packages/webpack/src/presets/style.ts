import { resolve } from 'pathe'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin'
import { fileName, WebpackConfigContext, applyPresets } from '../utils/config'
import { PostcssConfig } from '../utils/postcss'

export function style (ctx: WebpackConfigContext) {
  applyPresets(ctx, [
    loaders,
    extractCSS,
    minimizer
  ])
}

function minimizer (ctx: WebpackConfigContext) {
  const { options, config } = ctx

  if (options.build.optimizeCSS && Array.isArray(config.optimization.minimizer)) {
    config.optimization.minimizer.push(new CssMinimizerPlugin({
      ...options.build.optimizeCSS as any
    }))
  }
}

function extractCSS (ctx: WebpackConfigContext) {
  const { options, config } = ctx

  // CSS extraction
  if (options.build.extractCSS) {
    config.plugins.push(new MiniCssExtractPlugin({
      filename: fileName(ctx, 'css'),
      chunkFilename: fileName(ctx, 'css'),
      ...(options.build.extractCSS as any)
    }))
  }
}

function loaders (ctx: WebpackConfigContext) {
  const { config, options } = ctx

  // CSS
  config.module.rules.push(createdStyleRule('css', /\.css$/i, null, ctx))

  //  Postcss
  config.module.rules.push(createdStyleRule('postcss', /\.p(ost)?css$/i, null, ctx))

  // Less
  const lessLoader = { loader: 'less-loader', options: options.build.loaders.less }
  config.module.rules.push(createdStyleRule('less', /\.less$/i, lessLoader, ctx))

  // Sass (TODO: optional dependency)
  const sassLoader = { loader: 'sass-loader', options: options.build.loaders.sass }
  config.module.rules.push(createdStyleRule('sass', /\.sass$/i, sassLoader, ctx))

  const scssLoader = { loader: 'sass-loader', options: options.build.loaders.scss }
  config.module.rules.push(createdStyleRule('scss', /\.scss$/i, scssLoader, ctx))

  // Stylus
  const stylusLoader = { loader: 'stylus-loader', options: options.build.loaders.stylus }
  config.module.rules.push(createdStyleRule('stylus', /\.styl(us)?$/i, stylusLoader, ctx))
}

function createdStyleRule (lang: string, test: RegExp, processorLoader, ctx: WebpackConfigContext) {
  const { options } = ctx

  const styleLoaders = [
    createPostcssLoadersRule(ctx),
    processorLoader,
    createStyleResourcesLoaderRule(lang, options.build.styleResources, options.rootDir)
  ].filter(Boolean)

  options.build.loaders.css.importLoaders =
    options.build.loaders.cssModules.importLoaders =
    styleLoaders.length

  const cssLoaders = createCssLoadersRule(ctx, options.build.loaders.css)
  const cssModuleLoaders = createCssLoadersRule(ctx, options.build.loaders.cssModules)

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

function createCssLoadersRule (ctx: WebpackConfigContext, cssLoaderOptions) {
  const { options } = ctx

  const cssLoader = { loader: 'css-loader', options: cssLoaderOptions }

  if (options.build.extractCSS) {
    if (ctx.isServer) {
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
    {
      loader: 'vue-style-loader',
      options: options.build.loaders.vueStyle
    },
    cssLoader
  ]
}

function createStyleResourcesLoaderRule (styleLang, styleResources, rootDir) {
  // style-resources-loader
  // https://github.com/yenshih/style-resources-loader
  if (!styleResources[styleLang]) {
    return
  }

  return {
    loader: 'style-resources-loader',
    options: {
      patterns: Array.from(styleResources[styleLang]).map(p => resolve(rootDir, p as string)),
      ...styleResources.options
    }
  }
}

function createPostcssLoadersRule (ctx: WebpackConfigContext) {
  const { options, nuxt } = ctx

  if (!options.build.postcss) {
    return
  }

  const postcssConfig = new PostcssConfig(nuxt)
  const config = postcssConfig.config()

  if (!config) {
    return
  }

  return {
    loader: 'postcss-loader',
    options: config
  }
}
