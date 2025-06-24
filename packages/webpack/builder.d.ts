declare module '#builder' {
  import type Webpack from 'webpack'
  import type MiniCssExtractPlugin from 'mini-css-extract-plugin'
  import type TsCheckerPlugin from 'fork-ts-checker-webpack-plugin'

  export const webpack: typeof Webpack
  export const WebpackBarPlugin: typeof import('webpackbar').default
  export const MiniCssExtractPlugin: typeof MiniCssExtractPlugin
  export const TsCheckerPlugin: typeof TsCheckerPlugin
  export const builder: 'webpack' | 'rspack'
}
