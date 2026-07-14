declare module '#builder' {
  import type Webpack from 'webpack'
  import type MiniCssExtractPlugin from 'mini-css-extract-plugin'
  import type TsCheckerPlugin from 'fork-ts-checker-webpack-plugin'
  import type VueLoaderPluginConstructor from 'vue-loader/dist/pluginWebpack5.js'

  export const webpack: typeof Webpack
  export const createRsbuild: undefined | ((options?: any) => Promise<any>)
  export const WebpackBarPlugin: typeof import('webpackbar').default
  export const MiniCssExtractPlugin: typeof MiniCssExtractPlugin
  export const TsCheckerPlugin: typeof TsCheckerPlugin
  export const VueLoaderPlugin: typeof VueLoaderPluginConstructor
  export const builder: 'webpack' | 'rspack'
  export const getVueLoaderHash: (value: string) => string
  export const vueLoader: string
}
