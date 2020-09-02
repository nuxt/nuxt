// import MiniCssExtractPlugin from 'mini-css-extract-plugin'
// import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin'
// import StyleLoader from '../utils/style-loader'

import { WebpackConfigContext } from '../utils/config'

export function style (_ctx: WebpackConfigContext) {
  // // CSS extraction)
  // if (options.build.extractCSS) {
  //   plugins.push(new MiniCssExtractPlugin(Object.assign({
  //     filename: fileName(ctx, 'css'),
  //     chunkFilename: fileName(ctx, 'css')
  //   }, options.build.extractCSS)))
  // }
  // CSS extraction
  // if (options.build.extractCSS) {
  //   plugins.push(new MiniCssExtractPlugin(Object.assign({
  //     filename: fileName(ctx, 'css'),
  //     chunkFilename: fileName(ctx, 'css'),
  //     // TODO: https://github.com/faceyspacey/extract-css-chunks-webpack-plugin/issues/132
  //     reloadAll: true
  //   }, options.build.extractCSS)))
  // }
  return [
    // {
    //   test: /\.css$/i,
    //   oneOf: styleLoader.apply('css')
    // },
    // {
    //   test: /\.p(ost)?css$/i,
    //   oneOf: styleLoader.apply('postcss')
    // },
    // {
    //   test: /\.less$/i,
    //   oneOf: styleLoader.apply('less', {
    //     loader: 'less-loader',
    //     options: loaders.less
    //   })
    // },
    // {
    //   test: /\.sass$/i,
    //   oneOf: styleLoader.apply('sass', {
    //     loader: 'sass-loader',
    //     options: loaders.sass
    //   })
    // },
    // {
    //   test: /\.scss$/i,
    //   oneOf: styleLoader.apply('scss', {
    //     loader: 'sass-loader',
    //     options: loaders.scss
    //   })
    // },
    // {
    //   test: /\.styl(us)?$/i,
    //   oneOf: styleLoader.apply('stylus', {
    //     loader: 'stylus-loader',
    //     options: loaders.stylus
    //   })
    // }
  ]
}
