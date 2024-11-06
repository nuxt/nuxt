declare module '#builder' {
  import type Webpack from 'webpack'
  import type WebpackBarPlugin from 'webpackbar'
  import type MiniCssExtractPlugin from 'mini-css-extract-plugin'

  export const webpack: typeof Webpack
  export const WebpackBarPlugin: typeof WebpackBarPlugin
  export const MiniCssExtractPlugin: typeof MiniCssExtractPlugin
  export const builder: 'webpack' | 'rspack'
}
