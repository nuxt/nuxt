import { rspack as webpack } from '@rsbuild/core'

export { default as WebpackBarPlugin } from 'webpackbar/rspack'

export const builder = 'rsbuild'
export { webpack }
export const MiniCssExtractPlugin = webpack.CssExtractRspackPlugin

export { TsCheckerRspackPlugin as TsCheckerPlugin } from 'ts-checker-rspack-plugin'
