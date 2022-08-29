import { join } from 'pathe'
import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  /** @version 3 */
  webpack: {
    /**
     * Nuxt uses `webpack-bundle-analyzer` to visualize your bundles and how to optimize them.
     *
     * Set to `true` to enable bundle analysis, or pass an object with options: [for webpack](https://github.com/webpack-contrib/webpack-bundle-analyzer#options-for-plugin) or [for vite](https://github.com/btd/rollup-plugin-visualizer#options).
     *
     * @example
     * ```js
     * analyze: {
     *   analyzerMode: 'static'
     * }
     * ```
     * @type {boolean | typeof import('webpack-bundle-analyzer').BundleAnalyzerPlugin.Options}
     */
    analyze: {
      $resolve: (val, get) => {
        if (val !== true) {
          return val ?? false
        }
        const rootDir = get('rootDir')
        return {
          template: 'treemap',
          projectRoot: rootDir,
          filename: join(rootDir, '.nuxt/stats', '{name}.html')
        }
      }
    },

    /**
     * Enable the profiler in webpackbar.
     *
     * It is normally enabled by CLI argument `--profile`.
     *
     * @see [webpackbar](https://github.com/unjs/webpackbar#profile).
     */
    profile: process.argv.includes('--profile'),

    /**
     * Enables Common CSS Extraction using
     * [Vue Server Renderer guidelines](https://ssr.vuejs.org/guide/css.html).
     *
     * Using [extract-css-chunks-webpack-plugin](https://github.com/faceyspacey/extract-css-chunks-webpack-plugin/) under the hood, your CSS will be extracted
     * into separate files, usually one per component. This allows caching your CSS and
     * JavaScript separately and is worth trying if you have a lot of global or shared CSS.
     *
     * @example
     * ```js
     * export default {
     *   webpack: {
     *     extractCSS: true,
     *     // or
     *     extractCSS: {
     *       ignoreOrder: true
     *     }
     *   }
     * }
     * ```
     *
     * If you want to extract all your CSS to a single file, there is a workaround for this.
     * However, note that it is not recommended to extract everything into a single file.
     * Extracting into multiple CSS files is better for caching and preload isolation. It
     * can also improve page performance by downloading and resolving only those resources
     * that are needed.
     *
     * @example
     * ```js
     * export default {
     *   webpack: {
     *     extractCSS: true,
     *     optimization: {
     *       splitChunks: {
     *         cacheGroups: {
     *           styles: {
     *             name: 'styles',
     *             test: /\.(css|vue)$/,
     *             chunks: 'all',
     *             enforce: true
     *           }
     *         }
     *       }
     *     }
     *   }
     * }
     * ```
     * @type {boolean | typeof import('mini-css-extract-plugin').PluginOptions}
     */
    extractCSS: true,

    /**
     * Enables CSS source map support (defaults to `true` in development).
     */
    cssSourceMap: {
      $resolve: (val, get) => val ?? get('dev')
    },

    /**
     * The polyfill library to load to provide URL and URLSearchParams.
     *
     * Defaults to `'url'` ([see package](https://www.npmjs.com/package/url)).
     */
    serverURLPolyfill: 'url',

    /**
     * Customize bundle filenames.
     *
     * To understand a bit more about the use of manifests, take a look at [this webpack documentation](https://webpack.js.org/guides/code-splitting/).
     *
     * @note Be careful when using non-hashed based filenames in production
     * as most browsers will cache the asset and not detect the changes on first load.
     *
     * This example changes fancy chunk names to numerical ids:
     *
     * @example
     * ```js
     * filenames: {
     *   chunk: ({ isDev }) => (isDev ? '[name].js' : '[id].[contenthash].js')
     * }
     * ```
     */
    filenames: {
      app: ({ isDev }: { isDev: boolean }) => isDev ? `[name].js` : `[contenthash:7].js`,
      chunk: ({ isDev }: { isDev: boolean }) => isDev ? `[name].js` : `[contenthash:7].js`,
      css: ({ isDev }: { isDev: boolean }) => isDev ? '[name].css' : 'css/[contenthash:7].css',
      img: ({ isDev }: { isDev: boolean }) => isDev ? '[path][name].[ext]' : 'img/[name].[contenthash:7].[ext]',
      font: ({ isDev }: { isDev: boolean }) => isDev ? '[path][name].[ext]' : 'fonts/[name].[contenthash:7].[ext]',
      video: ({ isDev }: { isDev: boolean }) => isDev ? '[path][name].[ext]' : 'videos/[name].[contenthash:7].[ext]'
    },

    /**
     * Customize the options of Nuxt's integrated webpack loaders.
     */
    loaders: {
      $resolve: (val, get) => {
        const styleLoaders = [
          'css', 'cssModules', 'less',
          'sass', 'scss', 'stylus', 'vueStyle'
        ]
        for (const name of styleLoaders) {
          const loader = val[name]
          if (loader && loader.sourceMap === undefined) {
            loader.sourceMap = Boolean(get('build.cssSourceMap'))
          }
        }
        return val
      },
      file: { esModule: false },
      fontUrl: { esModule: false, limit: 1000 },
      imgUrl: { esModule: false, limit: 1000 },
      pugPlain: {},
      vue: {
        productionMode: { $resolve: (val, get) => val ?? !get('dev') },
        transformAssetUrls: {
          video: 'src',
          source: 'src',
          object: 'src',
          embed: 'src'
        },
        compilerOptions: { $resolve: (val, get) => val ?? get('vue.compilerOptions') },
      },
      css: {
        importLoaders: 0,
        url: {
          filter: (url: string, resourcePath: string) => !url.startsWith('/'),
        },
        esModule: false
      },
      cssModules: {
        importLoaders: 0,
        url: {
          filter: (url: string, resourcePath: string) => !url.startsWith('/'),
        },
        esModule: false,
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
      stylus: {},
      vueStyle: {}
    },

    /**
     * Add webpack plugins.
     *
     * @example
     * ```js
     * import webpack from 'webpack'
     * import { version } from './package.json'
     * // ...
     * plugins: [
     *   new webpack.DefinePlugin({
     *     'process.VERSION': version
     *   })
     * ]
     * ```
     */
    plugins: [],

    /**
     * Terser plugin options.
     *
     * Set to false to disable this plugin, or pass an object of options.
     *
     * @see [terser-webpack-plugin documentation](https://github.com/webpack-contrib/terser-webpack-plugin).
     *
     * @note Enabling sourceMap will leave `//# sourceMappingURL` linking comment at
     * the end of each output file if webpack `config.devtool` is set to `source-map`.
     *
     * @type {false | typeof import('terser-webpack-plugin').BasePluginOptions & typeof import('terser-webpack-plugin').DefinedDefaultMinimizerAndOptions<any>}
     */
    terser: {

    },

    /**
     * Hard-replaces `typeof process`, `typeof window` and `typeof document` to tree-shake bundle.
     */
    aggressiveCodeRemoval: false,

    /**
     * OptimizeCSSAssets plugin options.
     *
     * Defaults to true when `extractCSS` is enabled.
     *
     * @see [css-minimizer-webpack-plugin documentation](https://github.com/webpack-contrib/css-minimizer-webpack-plugin).
     *
     * @type {false | typeof import('css-minimizer-webpack-plugin').BasePluginOptions & typeof import('css-minimizer-webpack-plugin').DefinedDefaultMinimizerAndOptions<any>}
     */
    optimizeCSS: {
      $resolve: (val, get) => val ?? (get('build.extractCSS') ? {} : false)
    },

    /**
     * Configure [webpack optimization](https://webpack.js.org/configuration/optimization/).
     * @type {false | typeof import('webpack').Configuration['optimization']}
     */
    optimization: {
      runtimeChunk: 'single',
      /** Set minimize to `false` to disable all minimizers. (It is disabled in development by default). */
      minimize: { $resolve: (val, get) => val ?? !get('dev') },
      /** You can set minimizer to a customized array of plugins. */
      minimizer: undefined,
      splitChunks: {
        chunks: 'all',
        automaticNameDelimiter: '/',
        cacheGroups: {}
      }
    },
    /**
     * Customize PostCSS Loader.
     * Same options as https://github.com/webpack-contrib/postcss-loader#options
     */
    postcss: {
      execute: undefined,
      postcssOptions: {
        config: {
          $resolve: (val, get) => val ?? get('postcss.config')
        },
        plugins: {
          $resolve: (val, get) => val ?? get('postcss.plugins')
        }
      },
      sourceMap: undefined,
      implementation: undefined,
      order: ''
    },

    /**
     * See [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware) for available options.
     * @type {typeof import('webpack-dev-middleware').Options<typeof import('http').IncomingMessage, typeof import('http').ServerResponse>}
     */
    devMiddleware: {
      stats: 'none'
    },
    /**
     * See [webpack-hot-middleware](https://github.com/webpack-contrib/webpack-hot-middleware) for available options.
     * @type {typeof import('webpack-hot-middleware').MiddlewareOptions & { client?: typeof import('webpack-hot-middleware').ClientOptions }}
     */
    hotMiddleware: {},
    /**
     * Set to `false` to disable the overlay provided by [FriendlyErrorsWebpackPlugin](https://github.com/nuxt/friendly-errors-webpack-plugin).
     */
    friendlyErrors: true,
    /**
     * Filters to hide build warnings.
     * @type {Array<(warn: typeof import('webpack').WebpackError) => boolean>}
     */
    warningIgnoreFilters: [],
  }
})
