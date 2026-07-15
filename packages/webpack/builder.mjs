import hashSum from 'hash-sum'
import VueLoaderPlugin from 'vue-loader/dist/pluginWebpack5.js'

export const builder = 'webpack'
export const createRsbuild = undefined
export { default as webpack } from 'webpack'
export { default as MiniCssExtractPlugin } from 'mini-css-extract-plugin'
export { default as WebpackBarPlugin } from 'webpackbar'
export { default as TsCheckerPlugin } from 'fork-ts-checker-webpack-plugin'
export { VueLoaderPlugin }
export const getVueLoaderHash = hashSum
export const vueLoader = 'vue-loader'
