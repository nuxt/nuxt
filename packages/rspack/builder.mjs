import { createRsbuild, rspack as webpack } from '@rsbuild/core'

export { default as WebpackBarPlugin } from 'webpackbar/rspack'

export const builder = 'rspack'
export { createRsbuild }
export { webpack }
export const MiniCssExtractPlugin = webpack.CssExtractRspackPlugin

export { TsCheckerRspackPlugin as TsCheckerPlugin } from 'ts-checker-rspack-plugin'
