declare module '#builder' {
  import type Webpack from 'webpack'
  import type MiniCssExtractPlugin from 'mini-css-extract-plugin'

  export const webpack: typeof Webpack
  export const MiniCssExtractPlugin: typeof MiniCssExtractPlugin
  export const builder: 'webpack' | 'rspack'
}
