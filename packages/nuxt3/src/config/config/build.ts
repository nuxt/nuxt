import env from 'std-env'
import type { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'

import type { TransformOptions, PluginItem } from '@babel/core'
import type { Options as AutoprefixerOptions } from 'autoprefixer'
import type { Options as FileLoaderOptions } from 'file-loader'
import type { Options as HtmlMinifierOptions } from 'html-minifier'
import type * as Less from 'less'
import type { Options as SassOptions } from 'node-sass'
import type { Options as OptimizeCssAssetsWebpackPluginOptions } from 'optimize-css-assets-webpack-plugin'
import type { Plugin as PostcssPlugin } from 'postcss'
import type { Options as PugOptions } from 'pug'
import type { TerserPluginOptions } from 'terser-webpack-plugin'
import type { VueLoaderOptions } from 'vue-loader'
import type {
  Configuration as WebpackConfiguration, WebpackPluginFunction,


} from 'webpack'
import type { Options as WebpackDevMiddlewareOptions } from 'webpack-dev-middleware'
import type { MiddlewareOptions as WebpackHotMiddlewareOptions, ClientOptions as WebpackHotMiddlewareClientOptions } from 'webpack-hot-middleware'


interface WebpackEnv {
  isClient: boolean
  isDev: boolean
  isLegacy: boolean
  isModern: boolean
  isServer: boolean
}

interface BabelPresetEnv {
  envName: 'client' | 'modern' | 'server'
}
interface Warning {
  message: string
  name: string
}

interface BabelOptions extends Pick<TransformOptions, Exclude<keyof TransformOptions, 'presets' | 'plugins'>> {
  cacheCompression?: boolean
  cacheDirectory?: boolean
  cacheIdentifier?: string
  customize?: string | null
  presets?: ((env: BabelPresetEnv & WebpackEnv, defaultPreset: [string, object]) => PluginItem[] | void) | PluginItem[] | null
  plugins?: ((env: BabelPresetEnv & WebpackEnv) => NonNullable<TransformOptions['plugins']>) | TransformOptions['plugins']
}

type CssLoaderUrlFunction = (url: string, resourcePath: string) => boolean
type CssLoaderImportFunction = (parsedImport: string, resourcePath: string) => boolean
type CssLoaderMode = 'global' | 'local'
interface CssLoaderModulesOptions {
  context?: string
  getLocalIdent?: (context: string, localIdentName: string, localName: string, options: CssLoaderModulesOptions) => string
  hashPrefix?: string
  localIdentName?: string
  localIdentRegExp?: string | RegExp
  mode?: CssLoaderMode
}
interface CssLoaderOptions {
  import?: boolean | CssLoaderImportFunction
  importLoaders?: number
  localsConvention?: 'asIs' | 'camelCase' | 'camelCaseOnly' | 'dashes' | 'dashesOnly'
  modules?: boolean | CssLoaderMode | CssLoaderModulesOptions
  onlyLocals?: boolean
  sourceMap?: boolean
  url?: boolean | CssLoaderUrlFunction
}

interface UrlLoaderOptions {
  esModule?: boolean
  // TODO
  fallback?: any // WebpackLoader
  limit?: boolean | number | string
  mimetype?: string
}

interface WebpackEnv {
  isClient: boolean
  isDev: boolean
  isLegacy: boolean
  isModern: boolean
  isServer: boolean
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
  } | ((loader: any) => PostcssPlugin<any>[]) | Array<[string | PostcssPlugin<any>, any] | string | PostcssPlugin<any>>
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

interface VueStyleOptions {
  manualInject?: boolean
  ssrId?: boolean
  shadowMode?: boolean
}

interface Loaders {
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

export interface Template {
  /**
   * Source file. Can be absolute or relative.
   */
  src: string,
  /**
   * Destination file within `.nuxt` filter. This filename should be relative to the project `.nuxt` dir
   */
  dst: string,
  /**
   * Options are provided to template as `options` key
   */
  options?: Record<string, any>
}

export default () => ({
  /**
   * @private
   */
  _publicPath: '/_nuxt/',

  additionalExtensions: [] as string[],
  aggressiveCodeRemoval: false,
  /**
   * Use [webpack-bundle-analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer) to let you visualize your bundles and how to optimize them.
   * @default false
   */
  analyze: false as boolean | BundleAnalyzerPlugin.Options,
  babel: {
    configFile: false,
    babelrc: false,
    cacheDirectory: undefined
  } as BabelOptions,
  /**
   * Enable cache of [terser-webpack-plugin](https://github.com/webpack-contrib/terser-webpack-plugin#options) and [cache-loader](https://github.com/webpack-contrib/cache-loader#cache-loader)
   * 
   * ⚠️ Experimental
   * @default false
   */
  cache: false,
  corejs: undefined as undefined | 'auto' | 2 | 3,
  crossorigin: undefined as undefined | string,
  /**
   * Enables CSS Source Map support.
   * @default true for dev and `false` for production
   */
  cssSourceMap: undefined as undefined | boolean,
  devMiddleware: {} as WebpackDevMiddlewareOptions,
  devtools: undefined as undefined | boolean,
  extend: null as null | ((
    config: WebpackConfiguration,
    ctx: {
      loaders: Loaders
    } & WebpackEnv
  ) => void),
  /**
   * Enables Common CSS Extraction using Vue Server Renderer guidelines.
   *
   * Using [extract-css-chunks-webpack-plugin](https://github.com/faceyspacey/extract-css-chunks-webpack-plugin/) under the hood, all your CSS will be extracted into separate files, usually one per component. This allows caching your CSS and JavaScript separately and is worth a try in case you have a lot of global or shared CSS.
   * 
   * @default false
   */
  extractCSS: false as boolean | Record<string, any>,
  /**
   * Customize bundle filenames.
   */
  filenames: {
    app: ({ isDev, isModern }: WebpackEnv) => isDev ? `[name]${isModern ? '.modern' : ''}.js` : `[name].[contenthash:7]${isModern ? '.modern' : ''}.js`,
    chunk: ({ isDev, isModern }: WebpackEnv) => isDev ? `[name]${isModern ? '.modern' : ''}.js` : `[name].[contenthash:7]${isModern ? '.modern' : ''}.js`,
    css: ({ isDev }: WebpackEnv) => isDev ? '[name].css' : '[name].[contenthash:7].css',
    img: ({ isDev }: WebpackEnv) => isDev ? '[path][name].[ext]' : 'img/[name].[contenthash:7].[ext]',
    font: ({ isDev }: WebpackEnv) => isDev ? '[path][name].[ext]' : 'fonts/[name].[contenthash:7].[ext]',
    video: ({ isDev }: WebpackEnv) => isDev ? '[path][name].[ext]' : 'videos/[name].[contenthash:7].[ext]'
  },
  /**
   * By default, the build process does not scan files inside symlinks. This boolean includes them, thus allowing usage of symlinks inside folders such as the "pages" folder, for example.
   * @default false
   */
  followSymlinks: false,
  /**
   * Enables or disables the overlay provided by [FriendlyErrorsWebpackPlugin](https://github.com/nuxt/friendly-errors-webpack-plugin)
   * @default true
   */
  friendlyErrors: true,
  hardSource: false,
  hotMiddleware: {} as WebpackHotMiddlewareOptions & { client?: WebpackHotMiddlewareClientOptions },
  html: {
    /**
     * Configuration for the [html-minifier plugin](https://github.com/kangax/html-minifier) used to minify HTML files created during the build process (will be applied for all modes).
     */
    minify: {
      collapseBooleanAttributes: true,
      decodeEntities: true,
      minifyCSS: true,
      minifyJS: true,
      processConditionalComments: true,
      removeEmptyAttributes: true,
      removeRedundantAttributes: true,
      trimCustomFragments: true,
      useShortDoctype: true
    }
  } as { minify: HtmlMinifierOptions },
  indicator: {
    position: 'bottom-right',
    backgroundColor: '#2E495E',
    color: '#00C48D'
  } as boolean | { position: string, backgroundColor: string, color: string },
  /**
   * Customize options of Nuxt.js integrated webpack loaders.
   */
  loaders: {
    /**
     * Mor details at https://github.com/webpack-contrib/file-loader#options
     */
    file: {},
    fontUrl: { limit: 1000 },
    imgUrl: { limit: 1000 },
    pugPlain: {},
    vue: {
      transformAssetUrls: {
        video: 'src',
        source: 'src',
        object: 'src',
        embed: 'src'
      }
    },
    css: {},
    cssModules: {
      modules: {
        localIdentName: '[local]_[hash:base64:5]'
      }
    },
    less: {},
    sass: {
      sassOptions: {
        indentedSyntax: true
      }
    },
    scss: {},
    // tODO
    stylus: {},
    vueStyle: {}
  } as Loaders,
  loadingScreen: {} as Record<string, any> | false,
  optimization: {
    runtimeChunk: 'single',
    minimize: undefined as boolean | undefined,
    minimizer: undefined,
    splitChunks: {
      chunks: 'all',
      name: undefined,
      cacheGroups: {
        default: {
          name: undefined
        }
      }
    }
  } as WebpackConfiguration['optimization'],
  optimizeCSS: undefined as undefined | OptimizeCssAssetsWebpackPluginOptions | boolean,
  /**
   * Enable [thread-loader](https://github.com/webpack-contrib/thread-loader#thread-loader) in webpack building
   * 
   * ⚠️ Experimental
   * @default false
   */
  parallel: false,
  plugins: [] as WebpackPluginFunction[],
  postcss: {
    preset: {
      // https://cssdb.org/#staging-process
      stage: 2
    }
  } as string[] | boolean | PostcssConfiguration | (() => PostcssConfiguration),
  /**
   * Enable the profiler in [WebpackBar](https://github.com/nuxt/webpackbar#profile)
   * @default false unless enabled by command line argument `--profile`
   */
  profile: process.argv.includes('--profile'),
  /**
   * Nuxt.js lets you upload your dist files to your CDN for maximum performances, simply set the `publicPath` to your CDN.
   * @default '/_nuxt/'
   * @example
    ```
    export default {
      build: {
        publicPath: 'https://cdn.nuxtjs.org'
      }
    }
    ```
    Then, when launching nuxt build, upload the content of .nuxt/dist/client directory to your CDN and voilà!
   */
  publicPath: '/_nuxt/',
  /**
   * Suppresses most of the build output log
   * @default true when a CI or test environment is detected by [std-env](https://github.com/nuxt-contrib/std-env)
   */
  quiet: Boolean(env.ci || env.test),
  /**
   * @default 'url'
   */
  serverURLPolyfill: 'url',
  splitChunks: {
    layouts: false,
    pages: true,
    commons: true
  },
  /**
   * Creates special webpack bundle for SSR renderer. 
   * @default true for universal mode and `false` for spa mode
   */
  ssr: undefined as undefined | boolean,
  /**
   * 
   */
  standalone: false,
  stats: {
    excludeAssets: [
      /.map$/,
      /index\..+\.html$/,
      /vue-ssr-(client|modern)-manifest.json/
    ]
  } as 'none' | false | { excludeAssets: RegExp[] },
  styleResources: {},
  template: undefined,
  /**
   * Nuxt.js allows you provide your own templates which will be rendered based on Nuxt configuration. This feature is specially useful for using with modules.
   */
  templates: [] as Template[],
  /**
   * Terser plugin options. Set to `false` to disable this plugin. See https://github.com/webpack-contrib/terser-webpack-plugin 
   */
  terser: {} as TerserPluginOptions | boolean,
  // Name of NPM packages to be transpiled
  transpile: [] as Array<string | RegExp | ((context: WebpackEnv) => string | RegExp | undefined)>,
  warningIgnoreFilters: [] as Array<(warn: Warning) => boolean>,
  /**
   * You can provide your custom files to watch and regenerate after changes. This feature is specially useful for using with modules.
   */
  watch: [] as string[],

})
