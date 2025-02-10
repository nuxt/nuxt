import webpack from '@rspack/core'

export { default as WebpackBarPlugin } from 'webpackbar/rspack'

export const builder = 'rspack'
export { webpack }
export const MiniCssExtractPlugin = webpack.CssExtractRspackPlugin
