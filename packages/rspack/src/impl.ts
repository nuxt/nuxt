import { createHash } from 'node:crypto'
import { resolveModulePath } from 'exsolve'
import { createRequire } from 'node:module'
import { createRsbuild, rspack } from '@rsbuild/core'
import { VueLoaderPlugin } from 'rspack-vue-loader'
import WebpackBarPlugin from 'webpackbar/rspack'
import { TsCheckerRspackPlugin } from 'ts-checker-rspack-plugin'

import type { BuilderImpl } from '../../webpack/src/builder-registry.ts'
import { setBuilderImpl } from '../../webpack/src/builder-registry.ts'

const require = createRequire(import.meta.url)

export const impl: BuilderImpl = {
  builder: 'rspack',
  webpack: rspack as unknown as BuilderImpl['webpack'],
  createRsbuild,
  WebpackBarPlugin: WebpackBarPlugin as unknown as BuilderImpl['WebpackBarPlugin'],
  MiniCssExtractPlugin: rspack.CssExtractRspackPlugin as unknown as BuilderImpl['MiniCssExtractPlugin'],
  TsCheckerPlugin: TsCheckerRspackPlugin as unknown as BuilderImpl['TsCheckerPlugin'],
  VueLoaderPlugin: VueLoaderPlugin as unknown as BuilderImpl['VueLoaderPlugin'],
  getVueLoaderHash: value => createHash('sha256').update(value).digest('hex').substring(0, 8),
  vueLoader: require.resolve('rspack-vue-loader'),
  vueModuleIdentifierLoader: resolveModulePath('#vue-module-identifier', { from: import.meta.url }),
}

setBuilderImpl(impl)
