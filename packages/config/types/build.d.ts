/**
 * NuxtConfigurationBuild
 * Documentation: https://nuxtjs.org/api/configuration-build
 */

import {
  Configuration as WebpackConfiguration,
  Options as WebpackOptions,
  Plugin as WebpackPlugin
} from 'webpack'
import { TransformOptions, PluginItem } from '@babel/core'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import { Options as WebpackDevMiddlewareOptions } from 'webpack-dev-middleware'
import { Options as WebpackHotMiddlewareOptions } from 'webpack-hot-middleware'
import { Options as HtmlMinifierOptions } from 'html-minifier'
import { Options as OptimizeCssAssetsWebpackPluginOptions } from 'optimize-css-assets-webpack-plugin'
import { TerserPluginOptions } from 'terser-webpack-plugin'

type NuxtConfigurationLoaders = any // TBD

interface NuxtBabelPresetEnv {
  isServer: boolean
}

interface NuxtBabelOptions extends Pick<TransformOptions, Exclude<keyof TransformOptions, 'presets'>> {
  presets?: ((env: NuxtBabelPresetEnv, defaultPreset: [string, object]) => PluginItem[] | void) | PluginItem[] | null
}

export interface NuxtConfigurationBuild {
  analyze?: BundleAnalyzerPlugin.Options | boolean
  babel?: NuxtBabelOptions
  cache?: boolean
  crossorigin?: string
  cssSourceMap?: boolean
  devMiddleware?: WebpackDevMiddlewareOptions
  devtools?: boolean
  extend?(
    config: WebpackConfiguration,
    ctx: {
      isDev: boolean,
      isClient: boolean,
      isServer: boolean,
      loaders: NuxtConfigurationLoaders
    }
  ): void
  extractCSS?: boolean
  filenames?: { [key in 'app' | 'chunk' | 'css' | 'img' | 'font' | 'video']?: (ctx: { isDev: boolean }) => string }
  friendlyErrors?: boolean
  hardSource?: boolean
  hotMiddleware?: WebpackHotMiddlewareOptions
  html?: { minify: HtmlMinifierOptions }
  indicator?: boolean
  loaders?: NuxtConfigurationLoaders
  optimization?: WebpackOptions.Optimization
  optimizeCSS?: OptimizeCssAssetsWebpackPluginOptions | boolean
  parallel?: boolean
  plugins?: WebpackPlugin[]
  postcss?: any // TBD
  profile?: boolean
  publicPath?: string
  quiet?: boolean
  splitChunks?: {
    commons?: boolean
    layouts?: boolean
    pages?: boolean
  }
  ssr?: boolean
  templates?: any
  terser?: TerserPluginOptions | boolean
  transpile?: (string | RegExp)[]
  typescript?: {
    typeCheck?: { [key: string]: any } | boolean, // TBD - Couldn't find typedefs for the forkTsCheckerWebpackPlugin options
    ignoreNotFoundWarnings?: boolean
  }
  watch?: string[]
}
