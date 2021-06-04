/**
 * NuxtOptionsBuild
 * Documentation: https://nuxtjs.org/api/configuration-build
 */

import { TransformOptions, PluginItem } from '@babel/core'
import { Options as AutoprefixerOptions } from 'autoprefixer'
import { Options as FileLoaderOptions } from 'file-loader'
import { Options as HtmlMinifierOptions } from 'html-minifier'
import * as Less from 'less'
import { Options as SassOptions } from 'sass-loader'
import { Options as OptimizeCssAssetsWebpackPluginOptions } from 'optimize-css-assets-webpack-plugin'
import { Plugin as PostcssPlugin } from 'postcss'
import { Options as PugOptions } from 'pug'
import { TerserPluginOptions } from 'terser-webpack-plugin'
import { VueLoaderOptions } from 'vue-loader'
import {
  Configuration as WebpackConfiguration,
  Loader as WebpackLoader,
  loader as WebpackLoaderNamespace,
  Options as WebpackOptions,
  Plugin as WebpackPlugin
} from 'webpack'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import { Options as WebpackDevMiddlewareOptions } from 'webpack-dev-middleware'
import { MiddlewareOptions as WebpackHotMiddlewareOptions, ClientOptions as WebpackHotMiddlewareClientOptions } from 'webpack-hot-middleware'

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
  } | ((loader: WebpackLoaderNamespace.LoaderContext) => PostcssPlugin<any>[]) | Array<[string | PostcssPlugin<any>, any] | string | PostcssPlugin<any>>
  preset?: {
    autoprefixer?: false | AutoprefixerOptions
    browsers?: string
    exportTo?: string | string[] | Partial<PostcssVariableMap> | ((map: PostcssVariableMap) => Partial<PostcssVariableMap>)
    features?: {
      [key: string]: boolean | { [key: string]: any }
    }
    importFrom?: string | string[] | Partial<PostcssVariableMap> | (() => Partial<PostcssVariableMap>)
    insertAfter?: { [key: string]: PostcssPlugin<any> }
    insertBefore?: { [key: string]: PostcssPlugin<any> }
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
  devMiddleware?: WebpackDevMiddlewareOptions
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
  postcss?: string[] | boolean | PostcssConfiguration | (() => PostcssConfiguration)
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
  templates?: any
  terser?: TerserPluginOptions | boolean
  transpile?: Array<string | RegExp | ((context: NuxtWebpackEnv) => string | RegExp | undefined)>
  warningIgnoreFilters?: Array<(warn: Warning) => boolean>
  watch?: string[]
}
