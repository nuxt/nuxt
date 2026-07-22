import { resolveModulePath } from 'exsolve'
import hashSum from 'hash-sum'
import VueLoaderPlugin from 'vue-loader/dist/pluginWebpack5.js'
import webpack from 'webpack'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import WebpackBarPlugin from 'webpackbar'
import TsCheckerPlugin from 'fork-ts-checker-webpack-plugin'

import type { BuilderImpl } from './builder-registry.ts'
import { setBuilderImpl } from './builder-registry.ts'

export const impl: BuilderImpl = {
  builder: 'webpack',
  webpack,
  createRsbuild: undefined,
  WebpackBarPlugin,
  MiniCssExtractPlugin,
  TsCheckerPlugin,
  VueLoaderPlugin,
  getVueLoaderHash: hashSum,
  vueLoader: 'vue-loader',
  vueModuleIdentifierLoader: resolveModulePath('#vue-module-identifier', { from: import.meta.url }),
}

setBuilderImpl(impl)
