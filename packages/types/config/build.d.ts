/// <reference types="less" />
/**
 * NuxtOptionsBuild
 * Documentation: https://nuxtjs.org/api/configuration-build
 */

import type { IncomingMessage, ServerResponse } from 'http'
import type { TransformOptions, PluginItem } from '@babel/core'
import type { Options as AutoprefixerOptions } from 'autoprefixer'
import type { Options as FileLoaderOptions } from 'file-loader'
import type { Options as HtmlMinifierOptions } from 'html-minifier-terser'
import type { Options as OptimizeCssAssetsWebpackPluginOptions } from 'optimize-css-assets-webpack-plugin'
import type { Plugin as PostcssPlugin } from 'postcss'
import type { Options as PugOptions } from 'pug'
import type { TerserPluginOptions } from 'terser-webpack-plugin'
import type { VueLoaderOptions } from 'vue-loader'
import type {
  Configuration as WebpackConfiguration,
  Loader as WebpackLoader,
  loader as WebpackLoaderNamespace,
  Options as WebpackOptions,
  Plugin as WebpackPlugin
} from 'webpack'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import type { Options as WebpackDevMiddlewareOptions } from 'webpack-dev-middleware'
import type { MiddlewareOptions as WebpackHotMiddlewareOptions, ClientOptions as WebpackHotMiddlewareClientOptions } from 'webpack-hot-middleware'
import type { Options as SassOptions } from '../lib/sass-loader'

type CssLoaderUrlFunction = (url: string, resourcePath: string) => boolean
type CssLoaderImportFunction = (url: string, media: string, resourcePath: string) => boolean

type CssLoaderMode = 'global' | 'local' | 'pure'
interface CssLoaderModulesOptions {
  compileType?: 'module' | 'icss',
  mode?: CssLoaderMode,
  auto?: Boolean | RegExp | ((resourcePath: string) => boolean),
  exportGlobals?: boolean,
  localIdentName?: string,
  context?: string,
  localIdentHashPrefix?: string,
  namedExport?: boolean,
  exportLocalsConvention?: 'asIs' | 'camelCase' | 'camelCaseOnly' | 'dashes' | 'dashesOnly',
  exportOnlyLocals?: boolean,
}

interface CssLoaderOptions {
  url?: boolean | CssLoaderUrlFunction
  import?: boolean | CssLoaderImportFunction
  modules?: boolean | CssLoaderMode | CssLoaderModulesOptions
  sourceMap?: boolean
  importLoaders?: number
  esModule?: boolean
}

interface UrlLoaderOptions {
  esModule?: boolean
  fallback?: WebpackLoader
  limit?: boolean | number | string
  mimetype?: string
}

interface NuxtOptionsLoaders {
  css?: CssLoaderOptions
  cssModules?: CssLoaderOptions
  file?: FileLoaderOptions
  fontUrl?: UrlLoaderOptions
  imgUrl?: UrlLoaderOptions
  less?: Less.Options
  pugPlain?: PugOptions
  sass?: SassOptions
  scss?: SassOptions
  stylus?: any // TBD
  vue?: VueLoaderOptions
  vueStyle?: {
    manualInject?: boolean
    ssrId?: boolean
    shadowMode?: boolean
  }
}

interface NuxtWebpackEnv {
  isClient: boolean
  isDev: boolean
  isLegacy: boolean
  isModern: boolean
  isServer: boolean
}

interface NuxtBabelPresetEnv {
  envName: 'client' | 'modern' | 'server'
}

interface NuxtBabelOptions extends Pick<TransformOptions, Exclude<keyof TransformOptions, 'presets' | 'plugins'>> {
  cacheCompression?: boolean
  cacheDirectory?: boolean
  cacheIdentifier?: string
  customize?: string | null
  // eslint-disable-next-line @typescript-eslint/ban-types
  presets?: ((env: NuxtBabelPresetEnv & NuxtWebpackEnv, defaultPreset: [string, object]) => PluginItem[] | void) | PluginItem[] | null
  plugins?: ((env: NuxtBabelPresetEnv & NuxtWebpackEnv) => NonNullable<TransformOptions['plugins']>) | TransformOptions['plugins']
}

interface Warning {
  message: string
  name: string
}

interface PostcssOrderPresetFunctions {
  cssnanoLast: (names: string[]) => string[]
  presetEnvAndCssnanoLast: (names: string[]) => string[]
  presetEnvLast: (names: string[]) => string[]
}
type PostcssOrderPreset = keyof PostcssOrderPresetFunctions
interface PostcssVariableMap {
  customMedia: Record<string, string>
  customProperties: Record<string, string>
  customSelectors: Record<string, string>
  environmentVariables?: Record<string, string>
}

interface PostcssConfiguration {
  order?: PostcssOrderPreset | string[] | ((names: string[], presets: PostcssOrderPresetFunctions) => string[])
  plugins?: {
    [key: string]: false | { [key: string]: any }
  } | ((loader: WebpackLoaderNamespace.LoaderContext) => PostcssPlugin[]) | Array<[string | PostcssPlugin, any] | string | PostcssPlugin>
  readonly preset?: {
    autoprefixer?: false | AutoprefixerOptions
    browsers?: string
    exportTo?: string | string[] | Partial<PostcssVariableMap> | ((map: PostcssVariableMap) => Partial<PostcssVariableMap>)
    features?: {
      [key: string]: boolean | { [key: string]: any }
    }
    importFrom?: string | string[] | Partial<PostcssVariableMap> | (() => Partial<PostcssVariableMap>)
    insertAfter?: { [key: string]: PostcssPlugin }
    insertBefore?: { [key: string]: PostcssPlugin }
    preserve?: boolean
    stage?: 0 | 1 | 2 | 3 | 4 | false
  }
}

export interface NuxtOptionsBuild {
  additionalExtensions?: string[]
  analyze?: BundleAnalyzerPlugin.Options | boolean
  babel?: NuxtBabelOptions
  cache?: boolean
  corejs?: 'auto' | 2 | 3
  crossorigin?: string
  cssSourceMap?: boolean
  devMiddleware?: WebpackDevMiddlewareOptions<IncomingMessage, ServerResponse>
  devtools?: boolean
  extend?(
    config: WebpackConfiguration,
    ctx: {
      loaders: NuxtOptionsLoaders
    } & NuxtWebpackEnv
  ): void
  extractCSS?: boolean | Record<string, any>
  filenames?: { [key in 'app' | 'chunk' | 'css' | 'img' | 'font' | 'video']?: (ctx: NuxtWebpackEnv) => string }
  friendlyErrors?: boolean
  hardSource?: boolean
  hotMiddleware?: WebpackHotMiddlewareOptions & { client?: WebpackHotMiddlewareClientOptions }
  html?: { minify: false | HtmlMinifierOptions }
  indicator?: boolean
  loaders?: NuxtOptionsLoaders
  loadingScreen?: boolean | any
  optimization?: WebpackOptions.Optimization
  optimizeCSS?: OptimizeCssAssetsWebpackPluginOptions | boolean
  parallel?: boolean
  plugins?: WebpackPlugin[]
  postcss?: string[] | boolean | { postcssOptions: PostcssConfiguration | (() => PostcssConfiguration) }
  profile?: boolean
  publicPath?: string
  quiet?: boolean
  splitChunks?: {
    commons?: boolean
    layouts?: boolean
    pages?: boolean
  }
  ssr?: boolean
  standalone?: boolean
  stats?: WebpackConfiguration['stats']
  templates?: any
  terser?: TerserPluginOptions | boolean
  transpile?: Array<string | RegExp | ((context: NuxtWebpackEnv) => string | RegExp | undefined)>
  warningIgnoreFilters?: Array<(warn: Warning) => boolean>
  watch?: string[]
}
