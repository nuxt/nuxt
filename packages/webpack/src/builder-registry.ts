import type Webpack from 'webpack'
import type MiniCssExtractPluginType from 'mini-css-extract-plugin'
import type TsCheckerPluginType from 'fork-ts-checker-webpack-plugin'
import type VueLoaderPluginConstructor from 'vue-loader/dist/pluginWebpack5.js'

export interface BuilderImpl {
  builder: 'webpack' | 'rspack'
  webpack: typeof Webpack
  createRsbuild: undefined | ((options?: any) => Promise<any>)
  WebpackBarPlugin: typeof import('webpackbar').default
  MiniCssExtractPlugin: typeof MiniCssExtractPluginType
  TsCheckerPlugin: typeof TsCheckerPluginType
  VueLoaderPlugin: typeof VueLoaderPluginConstructor
  getVueLoaderHash: (value: string) => string
  vueLoader: string
  vueModuleIdentifierLoader: string
}

let _impl: BuilderImpl | undefined

/**
 * Injects the bundler implementation used by all modules in this package.
 *
 * Must be called before `builder.ts` is evaluated. Each builder package does
 * this by importing its `impl.ts` (which calls `setBuilderImpl` as a side
 * effect) as the first import of its entry module.
 */
export function setBuilderImpl (impl: BuilderImpl): void {
  _impl = impl
}

export function getBuilderImpl (): BuilderImpl {
  if (!_impl) {
    throw new Error('Builder implementation is not set. Import the builder package entry (or its `impl.ts`) before any module that uses the builder bindings.')
  }
  return _impl
}
