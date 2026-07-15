import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { createRsbuild, rspack as webpack } from '@rsbuild/core'
import { VueLoaderPlugin } from 'rspack-vue-loader'

const require = createRequire(import.meta.url)

export { default as WebpackBarPlugin } from 'webpackbar/rspack'

export const builder = 'rspack'
export { createRsbuild }
export { webpack }
export { VueLoaderPlugin }
export const getVueLoaderHash = value => createHash('sha256').update(value).digest('hex').substring(0, 8)
export const vueLoader = require.resolve('rspack-vue-loader')
export const MiniCssExtractPlugin = webpack.CssExtractRspackPlugin

export { TsCheckerRspackPlugin as TsCheckerPlugin } from 'ts-checker-rspack-plugin'
