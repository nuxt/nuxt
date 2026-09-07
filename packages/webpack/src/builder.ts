import { getBuilderImpl } from './builder-registry.ts'

export const {
  builder,
  webpack,
  createRsbuild,
  WebpackBarPlugin,
  MiniCssExtractPlugin,
  TsCheckerPlugin,
  VueLoaderPlugin,
  getVueLoaderHash,
  vueLoader,
  vueModuleIdentifierLoader,
} = getBuilderImpl()
