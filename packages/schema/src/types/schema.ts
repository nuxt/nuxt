import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AssetURLTagConfig } from '@vue/compiler-sfc'
import type { CompilerOptions } from '@vue/compiler-core'
import type { RenderSSRHeadOptions } from '@unhead/vue/types'
import type { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import type { PluginVisualizerOptions } from 'rollup-plugin-visualizer'
import type { TransformerOptions } from 'unctx/transform'
import type { SourceOptions } from 'c12'
import type { CompatibilityDateSpec } from 'compatx'
import type { Options } from 'ignore'
import type { ChokidarOptions } from 'chokidar'
import type { H3CorsOptions } from 'h3'
import type { NuxtLinkOptions } from 'nuxt/app'
import type { FetchOptions } from 'ofetch'
import type { NitroConfig, NitroDevEventHandler, NitroEventHandler } from 'nitro/types'
import type { Options as Options0 } from 'autoprefixer'
import type { Options as Options1 } from 'cssnano'
import type { TSConfig } from 'pkg-types'
import type { RawVueCompilerOptions } from '@vue/language-core'
import type { PluginOptions } from 'mini-css-extract-plugin'
import type { LoaderOptions } from 'esbuild-loader'
import type { Options as Options2 } from 'pug'
import type { VueLoaderOptions } from 'vue-loader'
import type { BasePluginOptions, DefinedDefaultMinimizerAndOptions } from 'css-minimizer-webpack-plugin'
import type { Configuration, WebpackError } from 'webpack'
import type { ProcessOptions } from 'postcss'
import type { Options as Options3 } from 'webpack-dev-middleware'
import type { ClientOptions, MiddlewareOptions } from 'webpack-hot-middleware'
import type { AppConfig as VueAppConfig } from 'vue'

import type { RouterConfigSerializable } from './router'
import type { NuxtHooks } from './hooks'
import type { ModuleMeta, NuxtModule } from './module'
import type { NuxtDebugOptions } from './debug'
import type { Nuxt, NuxtPlugin, NuxtTemplate } from './nuxt'
import type { SerializableHtmlAttributes } from './head'
import type { AppConfig, NuxtAppConfig, NuxtOptions, RuntimeConfig, Serializable, ViteConfig } from './config'
import type { ImportsOptions } from './imports'
import type { ComponentsOptions } from './components'

export interface ConfigSchema {
  /**
   * Configure Nuxt component auto-registration.
   *
   * Any components in the directories configured here can be used throughout your pages, layouts (and other components) without needing to explicitly import them.
   *
   * @see [`components/` directory documentation](https://nuxt.com/docs/guide/directory-structure/components)
   */
  components: boolean | ComponentsOptions | ComponentsOptions['dirs']

  /**
   * Configure how Nuxt auto-imports composables into your application.
   *
   * @see [Nuxt documentation](https://nuxt.com/docs/guide/directory-structure/composables)
   */
  imports: ImportsOptions

  /**
   * Whether to use the vue-router integration in Nuxt 3. If you do not provide a value it will be enabled if you have a `pages/` directory in your source folder.
   *
   * Additionally, you can provide a glob pattern or an array of patterns to scan only certain files for pages.
   *
   * @example
   * ```js
   * pages: {
   *   pattern: ['**\/*\/*.vue', '!**\/*.spec.*'],
   * }
   * ```
   */
  pages: boolean | { enabled?: boolean, pattern?: string | string[] }

  /**
   * Manually disable nuxt telemetry.
   *
   * @see [Nuxt Telemetry](https://github.com/nuxt/telemetry) for more information.
   */
  telemetry: boolean | Record<string, any>

  /**
   * Enable Nuxt DevTools for development.
   *
   * Breaking changes for devtools might not reflect on the version of Nuxt.
   *
   * @see  [Nuxt DevTools](https://devtools.nuxt.com/) for more information.
   */
  devtools: boolean | { enabled: boolean, [key: string]: any }

  /**
   * Vue.js config
   */
  vue: {
    transformAssetUrls: AssetURLTagConfig

    /**
     * Options for the Vue compiler that will be passed at build time.
     *
     * @see [Vue documentation](https://vuejs.org/api/application.html#app-config-compileroptions)
     */
    compilerOptions: CompilerOptions

    /**
     * Include Vue compiler in runtime bundle.
     *
     * @default false
     */
    runtimeCompiler: boolean

    /**
     * Enable reactive destructure for `defineProps`
     *
     * @default true
     */
    propsDestructure: boolean

    /**
     * It is possible to pass configure the Vue app globally. Only serializable options may be set in your `nuxt.config`. All other options should be set at runtime in a Nuxt plugin..
     *
     * @see [Vue app config documentation](https://vuejs.org/api/application.html#app-config)
     */
    config: Serializable<VueAppConfig>
  }

  /**
   * Nuxt App configuration.
   */
  app: {
  /**
   * The base path of your Nuxt application.
   *
   * For example:
   *
   * @default "/"
   *
   * @example
   * ```ts
   * export default defineNuxtConfig({
   *   app: {
   *     baseURL: '/prefix/'
   *   }
   * })
   * ```
   *
   * This can also be set at runtime by setting the NUXT_APP_BASE_URL environment variable.
   *
   * @example
   * ```bash
   * NUXT_APP_BASE_URL=/prefix/ node .output/server/index.mjs
   * ```
   */
    baseURL: string

    /**
     * The folder name for the built site assets, relative to `baseURL` (or `cdnURL` if set). This is set at build time and should not be customized at runtime.
     *
     * @default "/_nuxt/"
     */
    buildAssetsDir: string

    /**
     * An absolute URL to serve the public folder from (production-only).
     *
     * For example:
     *
     * @default ""
     *
     * @example
     * ```ts
     * export default defineNuxtConfig({
     *   app: {
     *     cdnURL: 'https://mycdn.org/'
     *   }
     * })
     * ```
     *
     * This can be set to a different value at runtime by setting the `NUXT_APP_CDN_URL` environment variable.
     *
     * @example
     * ```bash
     * NUXT_APP_CDN_URL=https://mycdn.org/ node .output/server/index.mjs
     * ```
     */
    cdnURL: string

    /**
     * Set default configuration for `<head>` on every page.
     *
     * @example
     * ```js
     * app: {
     *   head: {
     *     meta: [
     *       // <meta name="viewport" content="width=device-width, initial-scale=1">
     *       { name: 'viewport', content: 'width=device-width, initial-scale=1' }
     *     ],
     *     script: [
     *       // <script src="https://myawesome-lib.js"></script>
     *       { src: 'https://awesome-lib.js' }
     *     ],
     *     link: [
     *       // <link rel="stylesheet" href="https://myawesome-lib.css">
     *       { rel: 'stylesheet', href: 'https://awesome-lib.css' }
     *     ],
     *     // please note that this is an area that is likely to change
     *     style: [
     *       // <style>:root { color: red }</style>
     *       { textContent: ':root { color: red }' }
     *     ],
     *     noscript: [
     *       // <noscript>JavaScript is required</noscript>
     *       { textContent: 'JavaScript is required' }
     *     ]
     *   }
     * }
     * ```
     */
    head: NuxtAppConfig['head']

    /**
     * Default values for layout transitions.
     *
     * This can be overridden with `definePageMeta` on an individual page. Only JSON-serializable values are allowed.
     *
     * @default false
     *
     * @see [Vue Transition docs](https://vuejs.org/api/built-in-components.html#transition)
     */
    layoutTransition: NuxtAppConfig['layoutTransition']

    /**
     * Default values for page transitions.
     *
     * This can be overridden with `definePageMeta` on an individual page. Only JSON-serializable values are allowed.
     *
     * @default false
     *
     * @see [Vue Transition docs](https://vuejs.org/api/built-in-components.html#transition)
     */
    pageTransition: NuxtAppConfig['pageTransition']

    /**
     * Default values for view transitions.
     *
     * This only has an effect when **experimental** support for View Transitions is [enabled in your nuxt.config file](/docs/getting-started/transitions#view-transitions-api-experimental).
     * This can be overridden with `definePageMeta` on an individual page.
     *
     * @default false
     *
     * @see [Nuxt View Transition API docs](https://nuxt.com/docs/getting-started/transitions#view-transitions-api-experimental)
     */
    viewTransition: NuxtAppConfig['viewTransition']

    /**
     * Default values for KeepAlive configuration between pages.
     *
     * This can be overridden with `definePageMeta` on an individual page. Only JSON-serializable values are allowed.
     *
     * @default false
     *
     * @see [Vue KeepAlive](https://vuejs.org/api/built-in-components.html#keepalive)
     */
    keepalive: NuxtAppConfig['keepalive']

    /**
     * Customize Nuxt root element id.
     *
     * @default "__nuxt"
     *
     * @deprecated Prefer `rootAttrs.id` instead
     */
    rootId: string | false

    /**
     * Customize Nuxt root element tag.
     *
     * @default "div"
     */
    rootTag: string

    /**
     * Customize Nuxt root element id.
     *
     */
    rootAttrs: SerializableHtmlAttributes

    /**
     * Customize Nuxt Teleport element tag.
     *
     * @default "div"
     */
    teleportTag: string

    /**
     * Customize Nuxt Teleport element id.
     *
     * @default "teleports"
     *
     * @deprecated Prefer `teleportAttrs.id` instead
     */
    teleportId: string | false

    /**
     * Customize Nuxt Teleport element attributes.
     *
     */
    teleportAttrs: SerializableHtmlAttributes

    /**
     * Customize Nuxt SpaLoader element tag.
     *
     * @default "div"
     */
    spaLoaderTag: string

    /**
     * Customize Nuxt Nuxt SpaLoader element attributes.
     *
     */
    spaLoaderAttrs: SerializableHtmlAttributes
  }

  /**
   * Boolean or a path to an HTML file with the contents of which will be inserted into any HTML page rendered with `ssr: false`.
   *
   * - If it is unset, it will use `~/app/spa-loading-template.html` file in one of your layers, if it exists. - If it is false, no SPA loading indicator will be loaded. - If true, Nuxt will look for `~/app/spa-loading-template.html` file in one of your layers, or a
   *   default Nuxt image will be used.
   * Some good sources for spinners are [SpinKit](https://github.com/tobiasahlin/SpinKit) or [SVG Spinners](https://icones.js.org/collection/svg-spinners).
   *
   * @example ~/app/spa-loading-template.html
   * ```html
   * <!-- https://github.com/barelyhuman/snips/blob/dev/pages/css-loader.md -->
   * <div class="loader"></div>
   * <style>
   * .loader {
   *   display: block;
   *   position: fixed;
   *   z-index: 1031;
   *   top: 50%;
   *   left: 50%;
   *   transform: translate(-50%, -50%);
   *   width: 18px;
   *   height: 18px;
   *   box-sizing: border-box;
   *   border: solid 2px transparent;
   *   border-top-color: #000;
   *   border-left-color: #000;
   *   border-bottom-color: #efefef;
   *   border-right-color: #efefef;
   *   border-radius: 50%;
   *   -webkit-animation: loader 400ms linear infinite;
   *   animation: loader 400ms linear infinite;
   * }
   *
   * @-webkit-keyframes loader {
   *   0% {
   *     -webkit-transform: translate(-50%, -50%) rotate(0deg);
   *   }
   *   100% {
   *     -webkit-transform: translate(-50%, -50%) rotate(360deg);
   *   }
   * }
   * @keyframes loader {
   *   0% {
   *     transform: translate(-50%, -50%) rotate(0deg);
   *   }
   *   100% {
   *     transform: translate(-50%, -50%) rotate(360deg);
   *   }
   * }
   * </style>
   * ```
   */
  spaLoadingTemplate: string | boolean | undefined | null

  /**
   * An array of nuxt app plugins.
   *
   * Each plugin can be a string (which can be an absolute or relative path to a file). If it ends with `.client` or `.server` then it will be automatically loaded only in the appropriate context.
   * It can also be an object with `src` and `mode` keys.
   *
   * @note Plugins are also auto-registered from the `~/plugins` directory
   * and these plugins do not need to be listed in `nuxt.config` unless you
   * need to customize their order. All plugins are deduplicated by their src path.
   *
   * @see [`plugins/` directory documentation](https://nuxt.com/docs/guide/directory-structure/plugins)
   *
   * @example
   * ```js
   * plugins: [
   *   '~/plugins/foo.client.js', // only in client side
   *   '~/plugins/bar.server.js', // only in server side
   *   '~/plugins/baz.js', // both client & server
   *   { src: '~/plugins/both-sides.js' },
   *   { src: '~/plugins/client-only.js', mode: 'client' }, // only on client side
   *   { src: '~/plugins/server-only.js', mode: 'server' } // only on server side
   * ]
   * ```
   */
  plugins: (NuxtPlugin | string)[]

  /**
   * You can define the CSS files/modules/libraries you want to set globally (included in every page).
   *
   * Nuxt will automatically guess the file type by its extension and use the appropriate pre-processor. You will still need to install the required loader if you need to use them.
   *
   * @example
   * ```js
   * css: [
   *   // Load a Node.js module directly (here it's a Sass file).
   *   'bulma',
   *   // CSS file in the project
   *   '~/assets/css/main.css',
   *   // SCSS file in the project
   *   '~/assets/css/main.scss'
   * ]
   * ```
   */
  css: string[]

  /**
   * An object that allows us to configure the `unhead` nuxt module.
   */
  unhead: {
  /**
   * Enable the legacy compatibility mode for `unhead` module. This applies the following changes: - Disables Capo.js sorting - Adds the `DeprecationsPlugin`: supports `hid`, `vmid`, `children`, `body` - Adds the `PromisesPlugin`: supports promises as input
   *
   * @default false
   *
   * @see [`unhead` migration documentation](https://unhead.unjs.io/docs/typescript/head/guides/get-started/migration)
   *
   * @example
   * ```ts
   * export default defineNuxtConfig({
   *  unhead: {
   *   legacy: true
   * })
   * ```
   */
    legacy: boolean

    /**
     * An object that will be passed to `renderSSRHead` to customize the output.
     *
     * @example
     * ```ts
     * export default defineNuxtConfig({
     *  unhead: {
     *   renderSSRHeadOptions: {
     *    omitLineBreaks: true
     *   }
     * })
     * ```
     */
    renderSSRHeadOptions: RenderSSRHeadOptions
  }

  /**
   * The builder to use for bundling the Vue part of your application.
   *
   * @default "@nuxt/vite-builder"
   */
  builder: 'vite' | 'webpack' | 'rspack' | { bundle: (nuxt: Nuxt) => Promise<void> }

  /**
   * Configures whether and how sourcemaps are generated for server and/or client bundles.
   *
   * If set to a single boolean, that value applies to both server and client. Additionally, the `'hidden'` option is also available for both server and client.
   * Available options for both client and server: - `true`: Generates sourcemaps and includes source references in the final bundle. - `false`: Does not generate any sourcemaps. - `'hidden'`: Generates sourcemaps but does not include references in the final bundle.
   */
  sourcemap: boolean | { server?: boolean | 'hidden', client?: boolean | 'hidden' }

  /**
   * Log level when building logs.
   *
   * Defaults to 'silent' when running in CI or when a TTY is not available. This option is then used as 'silent' in Vite and 'none' in Webpack
   *
   * @default "info"
   */
  logLevel: 'silent' | 'info' | 'verbose'

  /**
   * Shared build configuration.
   */
  build: {
  /**
   * If you want to transpile specific dependencies with Babel, you can add them here. Each item in transpile can be a package name, a function, a string or regex object matching the dependency's file name.
   *
   * You can also use a function to conditionally transpile. The function will receive an object ({ isDev, isServer, isClient, isModern, isLegacy }).
   *
   * @example
   * ```js
   * transpile: [({ isLegacy }) => isLegacy && 'ky']
   * ```
   */
    transpile: Array<string | RegExp | ((ctx: { isClient?: boolean, isServer?: boolean, isDev: boolean }) => string | RegExp | false)>

    /**
     * It is recommended to use `addTemplate` from `@nuxt/kit` instead of this option.
     *
     * @example
     * ```js
     * templates: [
     *   {
     *     src: '~/modules/support/plugin.js', // `src` can be absolute or relative
     *     dst: 'support.js', // `dst` is relative to project `.nuxt` dir
     *   }
     * ]
     * ```
     */
    templates: NuxtTemplate<any>[]

    /**
     * Nuxt allows visualizing your bundles and how to optimize them.
     *
     * Set to `true` to enable bundle analysis, or pass an object with options: [for webpack](https://github.com/webpack-contrib/webpack-bundle-analyzer#options-for-plugin) or [for vite](https://github.com/btd/rollup-plugin-visualizer#options).
     *
     * @example
     * ```js
     * analyze: {
     *   analyzerMode: 'static'
     * }
     * ```
     */
    analyze: boolean | { enabled?: boolean } & ((0 extends 1 & BundleAnalyzerPlugin.Options ? Record<string, unknown> : BundleAnalyzerPlugin.Options) | PluginVisualizerOptions)
  }

  /**
   * Build time optimization configuration.
   */
  optimization: {
  /**
   * Functions to inject a key for.
   *
   * As long as the number of arguments passed to the function is less than `argumentLength`, an additional magic string will be injected that can be used to deduplicate requests between server and client. You will need to take steps to handle this additional key.
   * The key will be unique based on the location of the function being invoked within the file.
   *
   * @default [{"name":"callOnce","argumentLength":3},{"name":"defineNuxtComponent","argumentLength":2},{"name":"useState","argumentLength":2},{"name":"useFetch","argumentLength":3},{"name":"useAsyncData","argumentLength":3},{"name":"useLazyAsyncData","argumentLength":3},{"name":"useLazyFetch","argumentLength":3}]
   */
    keyedComposables: Array<{ name: string, source?: string | RegExp, argumentLength: number }>

    /**
     * Tree shake code from specific builds.
     *
     */
    treeShake: {
      /**
       * Tree shake composables from the server or client builds.
       *
       *
       * @example
       * ```js
       * treeShake: { client: { myPackage: ['useServerOnlyComposable'] } }
       * ```
       */
      composables: {
        server: Record<string, string[]>
        client: Record<string, string[]>
      }
    }

    /**
     * Options passed directly to the transformer from `unctx` that preserves async context after `await`.
     *
     */
    asyncTransforms: TransformerOptions
  }

  /**
   * Extend project from multiple local or remote sources.
   *
   * Value should be either a string or array of strings pointing to source directories or config path relative to current config.
   * You can use `github:`, `gh:` `gitlab:` or `bitbucket:`
   *
   * @see [`c12` docs on extending config layers](https://github.com/unjs/c12#extending-config-layer-from-remote-sources)
   *
   * @see [`giget` documentation](https://github.com/unjs/giget)
   */
  extends: string | [string, SourceOptions?] | (string | [string, SourceOptions?])[]

  /**
   * Specify a compatibility date for your app.
   *
   * This is used to control the behavior of presets in Nitro, Nuxt Image and other modules that may change behavior without a major version bump.
   * We plan to improve the tooling around this feature in the future.
   */
  compatibilityDate: CompatibilityDateSpec

  /**
   * Extend project from a local or remote source.
   *
   * Value should be a string pointing to source directory or config path relative to current config.
   * You can use `github:`, `gitlab:`, `bitbucket:` or `https://` to extend from a remote git repository.
   */
  theme: string

  /**
   * Define the root directory of your application.
   *
   * This property can be overwritten (for example, running `nuxt ./my-app/` will set the `rootDir` to the absolute path of `./my-app/` from the current/working directory.
   * It is normally not needed to configure this option.
   *
   * @default "/<rootDir>"
   */
  rootDir: string

  /**
   * Define the workspace directory of your application.
   *
   * Often this is used when in a monorepo setup. Nuxt will attempt to detect your workspace directory automatically, but you can override it here.
   * It is normally not needed to configure this option.
   *
   * @default "/<workspaceDir>"
   */
  workspaceDir: string

  /**
   * Define the source directory of your Nuxt application.
   *
   * If a relative path is specified, it will be relative to the `rootDir`.
   *
   * @default "/<srcDir>"
   *
   * @example
   * ```js
   * export default {
   *   srcDir: 'src/'
   * }
   * ```
   * This would work with the following folder structure:
   * ```bash
   * -| app/
   * ---| node_modules/
   * ---| nuxt.config.js
   * ---| package.json
   * ---| src/
   * ------| assets/
   * ------| components/
   * ------| layouts/
   * ------| middleware/
   * ------| pages/
   * ------| plugins/
   * ------| public/
   * ------| store/
   * ------| server/
   * ------| app.config.ts
   * ------| app.vue
   * ------| error.vue
   * ```
   */
  srcDir: string

  /**
   * Define the server directory of your Nuxt application, where Nitro routes, middleware and plugins are kept.
   *
   * If a relative path is specified, it will be relative to your `rootDir`.
   *
   * @default "/<rootDir>/server"
   */
  serverDir: string

  /**
   * Define the directory where your built Nuxt files will be placed.
   *
   * Many tools assume that `.nuxt` is a hidden directory (because it starts with a `.`). If that is a problem, you can use this option to prevent that.
   *
   * @default "/<rootDir>/.nuxt"
   *
   * @example
   * ```js
   * export default {
   *   buildDir: 'nuxt-build'
   * }
   * ```
   */
  buildDir: string

  /**
   * For multi-app projects, the unique id of the Nuxt application.
   *
   * Defaults to `nuxt-app`.
   *
   * @default "nuxt-app"
   */
  appId: string

  /**
   * A unique identifier matching the build. This may contain the hash of the current state of the project.
   *
   * @default "fa3ef6bd-0e10-41c8-9a55-ef6e58d5badd"
   */
  buildId: string

  /**
   * Used to set the modules directories for path resolving (for example, webpack's `resolveLoading`, `nodeExternals` and `postcss`).
   *
   * The configuration path is relative to `options.rootDir` (default is current working directory).
   * Setting this field may be necessary if your project is organized as a yarn workspace-styled mono-repository.
   *
   * @default ["/<rootDir>/node_modules"]
   *
   * @example
   * ```js
   * export default {
   *   modulesDir: ['../../node_modules']
   * }
   * ```
   */
  modulesDir: Array<string>

  /**
   * The directory where Nuxt will store the generated files when running `nuxt analyze`.
   *
   * If a relative path is specified, it will be relative to your `rootDir`.
   *
   * @default "/<rootDir>/.nuxt/analyze"
   */
  analyzeDir: string

  /**
   * Whether Nuxt is running in development mode.
   *
   * Normally, you should not need to set this.
   *
   * @default false
   */
  dev: boolean

  /**
   * Whether your app is being unit tested.
   *
   * @default false
   */
  test: boolean

  /**
   * Set to `true` to enable debug mode.
   *
   * At the moment, it prints out hook names and timings on the server, and logs hook arguments as well in the browser.
   * You can also set this to an object to enable specific debug options.
   *
   * @default false
   */
  debug: boolean | (NuxtDebugOptions) | undefined

  /**
   * Whether to enable rendering of HTML - either dynamically (in server mode) or at generate time. If set to `false` generated pages will have no content.
   *
   * @default true
   */
  ssr: boolean

  /**
   * Modules are Nuxt extensions which can extend its core functionality and add endless integrations.
   *
   * Each module is either a string (which can refer to a package, or be a path to a file), a tuple with the module as first string and the options as a second object, or an inline module function.
   * Nuxt tries to resolve each item in the modules array using node require path (in `node_modules`) and then will be resolved from project `srcDir` if `~` alias is used.
   *
   * @note Modules are executed sequentially so the order is important. First, the modules defined in `nuxt.config.ts` are loaded. Then, modules found in the `modules/`
   * directory are executed, and they load in alphabetical order.
   *
   * @example
   * ```js
   * modules: [
   *   // Using package name
   *   '@nuxtjs/axios',
   *   // Relative to your project srcDir
   *   '~/modules/awesome.js',
   *   // Providing options
   *   ['@nuxtjs/google-analytics', { ua: 'X1234567' }],
   *   // Inline definition
   *   function () {}
   * ]
   * ```
   */
  modules: (NuxtModule<any> | string | [NuxtModule | string, Record<string, any>] | undefined | null | false)[]

  /**
   * Customize default directory structure used by Nuxt.
   *
   * It is better to stick with defaults unless needed.
   */
  dir: {
  /** @default "/<srcDir>" */
    app: string

    /**
     * The assets directory (aliased as `~assets` in your build).
     *
     * @default "assets"
     */
    assets: string

    /**
     * The layouts directory, each file of which will be auto-registered as a Nuxt layout.
     *
     * @default "layouts"
     */
    layouts: string

    /**
     * The middleware directory, each file of which will be auto-registered as a Nuxt middleware.
     *
     * @default "middleware"
     */
    middleware: string

    /**
     * The modules directory, each file in which will be auto-registered as a Nuxt module.
     *
     * @default "/<rootDir>/modules"
     */
    modules: string

    /**
     * The directory which will be processed to auto-generate your application page routes.
     *
     * @default "pages"
     */
    pages: string

    /**
     * The plugins directory, each file of which will be auto-registered as a Nuxt plugin.
     *
     * @default "plugins"
     */
    plugins: string

    /**
     * The shared directory. This directory is shared between the app and the server.
     *
     * @default "shared"
     */
    shared: string

    /**
     * The directory containing your static files, which will be directly accessible via the Nuxt server and copied across into your `dist` folder when your app is generated.
     *
     * @default "/<rootDir>/public"
     */
    public: string

    /**
     * @default "public"
     *
     * @deprecated use `dir.public` option instead
     */
    static: string
  }

  /**
   * The extensions that should be resolved by the Nuxt resolver.
   *
   * @default [".js",".jsx",".mjs",".ts",".tsx",".vue"]
   */
  extensions: Array<string>

  /**
   * You can improve your DX by defining additional aliases to access custom directories within your JavaScript and CSS.
   *
   * @note Within a webpack context (image sources, CSS - but not JavaScript) you _must_ access
   * your alias by prefixing it with `~`.
   *
   * @note These aliases will be automatically added to the generated `.nuxt/tsconfig.json` so you can get full
   * type support and path auto-complete. In case you need to extend options provided by `./.nuxt/tsconfig.json`
   * further, make sure to add them here or within the `typescript.tsConfig` property in `nuxt.config`.
   *
   * @example
   * ```js
   * export default {
   *   alias: {
   *     'images': fileURLToPath(new URL('./assets/images', import.meta.url)),
   *     'style': fileURLToPath(new URL('./assets/style', import.meta.url)),
   *     'data': fileURLToPath(new URL('./assets/other/data', import.meta.url))
   *   }
   * }
   * ```
   *
   * ```html
   * <template>
   *   <img src="~images/main-bg.jpg">
   * </template>
   *
   * <script>
   * import data from 'data/test.json'
   * </script>
   *
   * <style>
   * // Uncomment the below
   * //@import '~style/variables.scss';
   * //@import '~style/utils.scss';
   * //@import '~style/base.scss';
   * body {
   *   background-image: url('~images/main-bg.jpg');
   * }
   * </style>
   * ```
   */
  alias: Record<string, string>

  /**
   * Pass options directly to `node-ignore` (which is used by Nuxt to ignore files).
   *
   * @see [node-ignore](https://github.com/kaelzhang/node-ignore)
   *
   * @example
   * ```js
   * ignoreOptions: {
   *   ignorecase: false
   * }
   * ```
   */
  ignoreOptions: Options

  /**
   * Any file in `pages/`, `layouts/`, `middleware/`, and `public/` directories will be ignored during the build process if its filename starts with the prefix specified by `ignorePrefix`. This is intended to prevent certain files from being processed or served in the built application. By default, the `ignorePrefix` is set to '-', ignoring any files starting with '-'.
   *
   * @default "-"
   */
  ignorePrefix: string

  /**
   * More customizable than `ignorePrefix`: all files matching glob patterns specified inside the `ignore` array will be ignored in building.
   *
   * @default ["**\/*.stories.{js,cts,mts,ts,jsx,tsx}","**\/*.{spec,test}.{js,cts,mts,ts,jsx,tsx}","**\/*.d.{cts,mts,ts}","**\/.{pnpm-store,vercel,netlify,output,git,cache,data}","**\/*.sock",".nuxt/analyze",".nuxt","**\/-*.*"]
   */
  ignore: Array<string>

  /**
   * The watch property lets you define patterns that will restart the Nuxt dev server when changed.
   *
   * It is an array of strings or regular expressions. Strings should be either absolute paths or relative to the `srcDir` (and the `srcDir` of any layers). Regular expressions will be matched against the path relative to the project `srcDir` (and the `srcDir` of any layers).
   */
  watch: Array<string | RegExp>

  /**
   * The watchers property lets you overwrite watchers configuration in your `nuxt.config`.
   */
  watchers: {
    /**
     * An array of event types, which, when received, will cause the watcher to restart.
     */
    rewatchOnRawEvents: string[]

    /**
     * `watchOptions` to pass directly to webpack.
     *
     * @see [webpack@4 watch options](https://v4.webpack.js.org/configuration/watch/#watchoptions).
     */
    webpack: {
      /** @default 1000 */
      aggregateTimeout: number
    }

    /**
     * Options to pass directly to `chokidar`.
     *
     * @see [chokidar](https://github.com/paulmillr/chokidar#api)
     */
    chokidar: ChokidarOptions
  }

  /**
   * Hooks are listeners to Nuxt events that are typically used in modules, but are also available in `nuxt.config`.
   *
   * Internally, hooks follow a naming pattern using colons (e.g., build:done).
   * For ease of configuration, you can also structure them as an hierarchical object in `nuxt.config` (as below).
   *
   * @example
   * ```js
   * import fs from 'node:fs'
   * import path from 'node:path'
   * export default {
   *   hooks: {
   *     build: {
   *       done(builder) {
   *         const extraFilePath = path.join(
   *           builder.nuxt.options.buildDir,
   *           'extra-file'
   *         )
   *         fs.writeFileSync(extraFilePath, 'Something extra')
   *       }
   *     }
   *   }
   * }
   * ```
   */
  hooks: NuxtHooks

  /**
   * Runtime config allows passing dynamic config and environment variables to the Nuxt app context.
   *
   * The value of this object is accessible from server only using `useRuntimeConfig`.
   * It mainly should hold _private_ configuration which is not exposed on the frontend. This could include a reference to your API secret tokens.
   * Anything under `public` and `app` will be exposed to the frontend as well.
   * Values are automatically replaced by matching env variables at runtime, e.g. setting an environment variable `NUXT_API_KEY=my-api-key NUXT_PUBLIC_BASE_URL=/foo/` would overwrite the two values in the example below.
   *
   * @example
   * ```js
   * export default {
   *  runtimeConfig: {
   *     apiKey: '', // Default to an empty string, automatically set at runtime using process.env.NUXT_API_KEY
   *     public: {
   *        baseURL: '' // Exposed to the frontend as well.
   *     }
   *   }
   * }
   * ```
   */
  runtimeConfig: RuntimeConfig

  /**
   * Additional app configuration
   *
   * For programmatic usage and type support, you can directly provide app config with this option. It will be merged with `app.config` file as default value.
   */
  appConfig: AppConfig

  devServer: {
  /**
   * Whether to enable HTTPS.
   *
   * @default false
   *
   * @example
   * ```ts
   * export default defineNuxtConfig({
   *   devServer: {
   *     https: {
   *       key: './server.key',
   *       cert: './server.crt'
   *     }
   *   }
   * })
   * ```
   */
    https: boolean | { key: string, cert: string } | { pfx: string, passphrase: string }

    /**
     * Dev server listening port
     *
     * @default 3000
     */
    port: number

    /**
     * Dev server listening host
     *
     */
    host: string | undefined

    /**
     * Listening dev server URL.
     *
     * This should not be set directly as it will always be overridden by the dev server with the full URL (for module and internal use).
     *
     * @default "http://localhost:3000"
     */
    url: string

    /**
     * Template to show a loading screen
     *
     */
    loadingTemplate: (data: { loading?: string }) => string

    /**
     * Set CORS options for the dev server
     *
     */
    cors: H3CorsOptions
  }

  /**
   * `future` is for early opting-in to new features that will become default in a future (possibly major) version of the framework.
   */
  future: {
  /**
   * Enable early access to future features or flags.
   *
   * It is currently not configurable but may be in future.
   *
   * @default 4
   */
    compatibilityVersion: 4

    /**
     * This enables early access to the experimental multi-app support.
     *
     * @default false
     *
     * @see [Nuxt Issue #21635](https://github.com/nuxt/nuxt/issues/21635)
     */
    multiApp: boolean

    /**
     * This enables 'Bundler' module resolution mode for TypeScript, which is the recommended setting for frameworks like Nuxt and Vite.
     *
     * It improves type support when using modern libraries with `exports`.
     * You can set it to false to use the legacy 'Node' mode, which is the default for TypeScript.
     *
     * @default true
     *
     * @see [TypeScript PR implementing `bundler` module resolution](https://github.com/microsoft/TypeScript/pull/51669)
     */
    typescriptBundlerResolution: boolean
  }

  /**
   * Some features of Nuxt are available on an opt-in basis, or can be disabled based on your needs.
   */
  features: {
  /**
   * Inline styles when rendering HTML (currently vite only).
   *
   * You can also pass a function that receives the path of a Vue component and returns a boolean indicating whether to inline the styles for that component.
   */
    inlineStyles: boolean | ((id?: string) => boolean)

    /**
     * Stream server logs to the client as you are developing. These logs can be handled in the `dev:ssr-logs` hook.
     *
     * If set to `silent`, the logs will not be printed to the browser console.
     *
     * @default false
     */
    devLogs: boolean | 'silent'

    /**
     * Turn off rendering of Nuxt scripts and JS resource hints. You can also disable scripts more granularly within `routeRules`.
     *
     * If set to 'production' or `true`, JS will be disabled in production mode only.
     *
     * @default false
     */
    noScripts: 'production' | 'all' | boolean
  }

  experimental: {
  /**
   * Enable to use experimental decorators in Nuxt and Nitro.
   *
   * @default false
   *
   * @see https://github.com/tc39/proposal-decorators
   */
    decorators: boolean

    /**
     * Set to true to generate an async entry point for the Vue bundle (for module federation support).
     *
     * @default false
     */
    asyncEntry: boolean

    /**
     * Externalize `vue`, `@vue/*` and `vue-router` when building.
     *
     * @default true
     *
     * @see [Nuxt Issue #13632](https://github.com/nuxt/nuxt/issues/13632)
     */
    externalVue: boolean

    /**
     * Enable accessing `appConfig` from server routes.
     *
     * @default false
     *
     * @deprecated This option is not recommended.
     */
    serverAppConfig: boolean

    /**
     * Emit `app:chunkError` hook when there is an error loading vite/webpack chunks.
     *
     * By default, Nuxt will also perform a reload of the new route when a chunk fails to load when navigating to a new route (`automatic`).
     * Setting `automatic-immediate` will lead Nuxt to perform a reload of the current route right when a chunk fails to load (instead of waiting for navigation).
     * You can disable automatic handling by setting this to `false`, or handle chunk errors manually by setting it to `manual`.
     *
     * @default "automatic"
     *
     * @see [Nuxt PR #19038](https://github.com/nuxt/nuxt/pull/19038)
     */
    emitRouteChunkError: false | 'manual' | 'automatic' | 'automatic-immediate'

    /**
     * By default the route object returned by the auto-imported `useRoute()` composable is kept in sync with the current page in view in `<NuxtPage>`. This is not true for `vue-router`'s exported `useRoute` or for the default `$route` object available in your Vue templates.
     *
     * By enabling this option a mixin will be injected to keep the `$route` template object in sync with Nuxt's managed `useRoute()`.
     *
     * @default true
     */
    templateRouteInjection: boolean

    /**
     * Whether to restore Nuxt app state from `sessionStorage` when reloading the page after a chunk error or manual `reloadNuxtApp()` call.
     *
     * To avoid hydration errors, it will be applied only after the Vue app has been mounted, meaning there may be a flicker on initial load.
     * Consider carefully before enabling this as it can cause unexpected behavior, and consider providing explicit keys to `useState` as auto-generated keys may not match across builds.
     *
     * @default false
     */
    restoreState: boolean

    /**
     * Render JSON payloads with support for revivifying complex types.
     *
     * @default true
     */
    renderJsonPayloads: boolean

    /**
     * Disable vue server renderer endpoint within nitro.
     *
     * @default false
     */
    noVueServer: boolean

    /**
     * When this option is enabled (by default) payload of pages that are prerendered are extracted
     *
     * @default true
     */
    payloadExtraction: boolean | undefined

    /**
     * Whether to enable the experimental `<NuxtClientFallback>` component for rendering content on the client if there's an error in SSR.
     *
     * @default false
     */
    clientFallback: boolean

    /**
     * Enable cross-origin prefetch using the Speculation Rules API.
     *
     * @default false
     */
    crossOriginPrefetch: boolean

    /**
     * Enable View Transition API integration with client-side router.
     *
     * @default false
     *
     * @see [View Transitions API](https://developer.chrome.com/docs/web-platform/view-transitions)
     */
    viewTransition: boolean | 'always'

    /**
     * Write early hints when using node server.
     *
     * @default false
     *
     * @note nginx does not support 103 Early hints in the current version.
     */
    writeEarlyHints: boolean

    /**
     * Experimental component islands support with `<NuxtIsland>` and `.island.vue` files.
     *
     * By default it is set to 'auto', which means it will be enabled only when there are islands, server components or server pages in your app.
     *
     * @default "auto"
     */
    componentIslands: true | 'auto' | 'local' | 'local+remote' | Partial<{ remoteIsland: boolean, selectiveClient: boolean | 'deep' }> | false

    /**
     * Resolve `~`, `~~`, `@` and `@@` aliases located within layers with respect to their layer source and root directories.
     *
     * @default true
     */
    localLayerAliases: boolean

    /**
     * Enable the new experimental typed router using [unplugin-vue-router](https://github.com/posva/unplugin-vue-router).
     *
     * @default false
     */
    typedPages: boolean

    /**
     * Use app manifests to respect route rules on client-side.
     *
     * @default true
     */
    appManifest: boolean

    /**
     * Set the time interval (in ms) to check for new builds. Disabled when `experimental.appManifest` is `false`.
     *
     * Set to `false` to disable.
     *
     * @default 3600000
     */
    checkOutdatedBuildInterval: number | false

    /**
     * Set an alternative watcher that will be used as the watching service for Nuxt.
     *
     * Nuxt uses 'chokidar-granular' if your source directory is the same as your root directory . This will ignore top-level directories (like `node_modules` and `.git`) that are excluded from watching.
     * You can set this instead to `parcel` to use `@parcel/watcher`, which may improve performance in large projects or on Windows platforms.
     * You can also set this to `chokidar` to watch all files in your source directory.
     *
     * @default "chokidar"
     *
     * @see [chokidar](https://github.com/paulmillr/chokidar)
     *
     * @see [@parcel/watcher](https://github.com/parcel-bundler/watcher)
     */
    watcher: 'chokidar' | 'parcel' | 'chokidar-granular'

    /**
     * Enable native async context to be accessible for nested composables
     *
     * @default false
     *
     * @see [Nuxt PR #20918](https://github.com/nuxt/nuxt/pull/20918)
     */
    asyncContext: boolean

    /**
     * Use new experimental head optimisations:
     *
     * - Add the capo.js head plugin in order to render tags in of the head in a more performant way. - Uses the hash hydration plugin to reduce initial hydration
     *
     * @default true
     *
     * @see [Nuxt Discussion #22632](https://github.com/nuxt/nuxt/discussions/22632)
     */
    headNext: boolean

    /**
     * Allow defining `routeRules` directly within your `~/pages` directory using `defineRouteRules`.
     *
     * Rules are converted (based on the path) and applied for server requests. For example, a rule defined in `~/pages/foo/bar.vue` will be applied to `/foo/bar` requests. A rule in `~/pages/foo/[id].vue` will be applied to `/foo/**` requests.
     * For more control, such as if you are using a custom `path` or `alias` set in the page's `definePageMeta`, you should set `routeRules` directly within your `nuxt.config`.
     *
     * @default false
     */
    inlineRouteRules: boolean

    /**
     * Allow exposing some route metadata defined in `definePageMeta` at build-time to modules (alias, name, path, redirect, props, middleware).
     *
     * This only works with static or strings/arrays rather than variables or conditional assignment.
     *
     * @default "after-resolve"
     *
     * @see [Nuxt Issues #24770](https://github.com/nuxt/nuxt/issues/24770)
     */
    scanPageMeta: boolean | 'after-resolve'

    /**
     * Configure additional keys to extract from the page metadata when using `scanPageMeta`.
     *
     * This allows modules to access additional metadata from the page metadata. It's recommended to augment the NuxtPage types with your keys.
     *
     */
    extraPageMetaExtractionKeys: string[]

    /**
     * Automatically share payload _data_ between pages that are prerendered. This can result in a significant performance improvement when prerendering sites that use `useAsyncData` or `useFetch` and fetch the same data in different pages.
     *
     * It is particularly important when enabling this feature to make sure that any unique key of your data is always resolvable to the same data. For example, if you are using `useAsyncData` to fetch data related to a particular page, you should provide a key that uniquely matches that data. (`useFetch` should do this automatically for you.)
     *
     * @default true
     *
     * @example
     * ```ts
     * // This would be unsafe in a dynamic page (e.g. `[slug].vue`) because the route slug makes a difference
     * // to the data fetched, but Nuxt can't know that because it's not reflected in the key.
     * const route = useRoute()
     * const { data } = await useAsyncData(async () => {
     *   return await $fetch(`/api/my-page/${route.params.slug}`)
     * })
     * // Instead, you should use a key that uniquely identifies the data fetched.
     * const { data } = await useAsyncData(route.params.slug, async () => {
     *   return await $fetch(`/api/my-page/${route.params.slug}`)
     * })
     * ```
     */
    sharedPrerenderData: boolean

    /**
     * Enables CookieStore support to listen for cookie updates (if supported by the browser) and refresh `useCookie` ref values.
     *
     * @default true
     *
     * @see [CookieStore](https://developer.mozilla.org/en-US/docs/Web/API/CookieStore)
     */
    cookieStore: boolean

    /**
     * This allows specifying the default options for core Nuxt components and composables.
     *
     * These options will likely be moved elsewhere in the future, such as into `app.config` or into the `app/` directory.
     *
     */
    defaults: {
      nuxtLink: NuxtLinkOptions

      /**
       * Options that apply to `useAsyncData` (and also therefore `useFetch`)
       */
      useAsyncData: {
        /** @default false */
        deep: boolean
      }

      useFetch: Pick<FetchOptions, 'timeout' | 'retry' | 'retryDelay' | 'retryStatusCodes'>
    }

    /**
     * Automatically polyfill Node.js imports in the client build using `unenv`.
     *
     * @default false
     *
     * @see [unenv](https://github.com/unjs/unenv)
     *
     * **Note:** To make globals like `Buffer` work in the browser, you need to manually inject them.
     *
     * ```ts
     * import { Buffer } from 'node:buffer'
     *
     * globalThis.Buffer = globalThis.Buffer || Buffer
     * ```
     */
    clientNodeCompat: boolean

    /**
     * Wait for a single animation frame before navigation, which gives an opportunity for the browser to repaint, acknowledging user interaction.
     *
     * It can reduce INP when navigating on prerendered routes.
     *
     * @default true
     */
    navigationRepaint: boolean

    /**
     * Cache Nuxt/Nitro build artifacts based on a hash of the configuration and source files.
     *
     * This only works for source files within `srcDir` and `serverDir` for the Vue/Nitro parts of your app.
     *
     * @default false
     */
    buildCache: boolean

    /**
     * Ensure that auto-generated Vue component names match the full component name you would use to auto-import the component.
     *
     * @default true
     */
    normalizeComponentNames: boolean

    /**
     * Keep showing the spa-loading-template until suspense:resolve
     *
     * @default "body"
     *
     * @see [Nuxt Issues #21721](https://github.com/nuxt/nuxt/issues/21721)
     */
    spaLoadingTemplateLocation: 'body' | 'within'

    /**
     * Enable timings for Nuxt application hooks in the performance panel of Chromium-based browsers.
     *
     * This feature adds performance markers for Nuxt hooks, allowing you to track their execution time in the browser's Performance tab. This is particularly useful for debugging performance issues.
     *
     * @default false
     *
     * @example
     * ```ts
     * // nuxt.config.ts
     * export default defineNuxtConfig({
     *   experimental: {
     *     // Enable performance markers for Nuxt hooks in browser devtools
     *     browserDevtoolsTiming: true
     *   }
     * })
     * ```
     *
     * @see [PR #29922](https://github.com/nuxt/nuxt/pull/29922)
     *
     * @see [Chrome DevTools Performance API](https://developer.chrome.com/docs/devtools/performance/extension#tracks)
     */
    browserDevtoolsTiming: boolean

    /**
     * Record mutations to `nuxt.options` in module context, helping to debug configuration changes made by modules during the Nuxt initialization phase.
     *
     * When enabled, Nuxt will track which modules modify configuration options, making it easier to trace unexpected configuration changes.
     *
     * @default false
     *
     * @example
     * ```ts
     * // nuxt.config.ts
     * export default defineNuxtConfig({
     *   experimental: {
     *     // Enable tracking of config mutations by modules
     *     debugModuleMutation: true
     *   }
     * })
     * ```
     *
     * @see [PR #30555](https://github.com/nuxt/nuxt/pull/30555)
     */
    debugModuleMutation: boolean

    /**
     * Enable automatic configuration of hydration strategies for `<Lazy>` components.
     *
     * This feature intelligently determines when to hydrate lazy components based on visibility, idle time, or other triggers, improving performance by deferring hydration of components until they're needed.
     *
     * @default true
     *
     * @example
     * ```ts
     * // nuxt.config.ts
     * export default defineNuxtConfig({
     *   experimental: {
     *     lazyHydration: true // Enable smart hydration strategies for Lazy components
     *   }
     * })
     *
     * // In your Vue components
     * <template>
     *   <Lazy>
     *     <ExpensiveComponent />
     *   </Lazy>
     * </template>
     * ```
     *
     * @see [PR #26468](https://github.com/nuxt/nuxt/pull/26468)
     */
    lazyHydration: boolean

    /**
     * Disable resolving imports into Nuxt templates from the path of the module that added the template.
     *
     * By default, Nuxt attempts to resolve imports in templates relative to the module that added them. Setting this to `false` disables this behavior, which may be useful if you're experiencing resolution conflicts in certain environments.
     *
     * @default true
     *
     * @example
     * ```ts
     * // nuxt.config.ts
     * export default defineNuxtConfig({
     *   experimental: {
     *     // Disable template import resolution from module path
     *     templateImportResolution: false
     *   }
     * })
     * ```
     *
     * @see [PR #31175](https://github.com/nuxt/nuxt/pull/31175)
     */
    templateImportResolution: boolean

    /**
     * Whether to clean up Nuxt static and asyncData caches on route navigation.
     *
     * Nuxt will automatically purge cached data from `useAsyncData` and `nuxtApp.static.data`. This helps prevent memory leaks and ensures fresh data is loaded when needed, but it is possible to disable it.
     *
     * @default true
     *
     * @example
     * ```ts
     * // nuxt.config.ts
     * export default defineNuxtConfig({
     *   experimental: {
     *     // Disable automatic cache cleanup (default is true)
     *     purgeCachedData: false
     *   }
     * })
     * ```
     *
     * @see [PR #31379](https://github.com/nuxt/nuxt/pull/31379)
     */
    purgeCachedData: boolean

    /**
     * Whether to call and use the result from `getCachedData` on manual refresh for `useAsyncData` and `useFetch`.
     *
     * @default true
     */
    granularCachedData: boolean

    /**
     * Whether to parse `error.data` when rendering a server error page.
     *
     * @default true
     */
    parseErrorData: boolean

    /**
     * Whether Nuxt should stop if a Nuxt module is incompatible.
     *
     * @default false
     */
    enforceModuleCompatibility: boolean

    /**
     * For `useAsyncData` and `useFetch`, whether `pending` should be `true` when data has not yet started to be fetched.
     *
     * @default false
     */
    pendingWhenIdle: boolean
  }

  generate: {
  /**
   * The routes to generate.
   *
   * If you are using the crawler, this will be only the starting point for route generation. This is often necessary when using dynamic routes.
   * It is preferred to use `nitro.prerender.routes`.
   *
   * @example
   * ```js
   * routes: ['/users/1', '/users/2', '/users/3']
   * ```
   */
    routes: string | string[]

    /**
     * This option is no longer used. Instead, use `nitro.prerender.ignore`.
     *
     * @deprecated
     */
    exclude: Array<any>
  }

  /**
   * @default 4
   *
   * @private
   */
  _majorVersion: number

  /**
   * @default false
   *
   * @private
   */
  _legacyGenerate: boolean

  /**
   * @default false
   *
   * @private
   */
  _start: boolean

  /**
   * @default false
   *
   * @private
   */
  _build: boolean

  /**
   * @default false
   *
   * @private
   */
  _generate: boolean

  /**
   * @default false
   *
   * @private
   */
  _prepare: boolean

  /**
   * @default false
   *
   * @private
   */
  _cli: boolean

  /**
   *
   * @private
   */
  _requiredModules: Record<string, boolean>

  /**
   *
   * @private
   */
  _loadOptions: { dotenv?: boolean | import('c12').DotenvOptions }

  /**
   *
   * @private
   */
  _nuxtConfigFile: string

  /**
   *
   * @private
   */
  _nuxtConfigFiles: Array<string>

  /**
   * @default ""
   *
   * @private
   */
  appDir: string

  /**
   *
   * @private
   */
  _installedModules: Array<{ meta: ModuleMeta, module: NuxtModule, timings?: Record<string, number | undefined>, entryPath?: string }>

  /**
   *
   * @private
   */
  _modules: Array<any>

  /**
   * Configuration for Nitro.
   *
   * @see [Nitro configuration docs](https://nitro.unjs.io/config/)
   */
  nitro: NitroConfig

  /**
   * Global route options applied to matching server routes.
   *
   * @experimental This is an experimental feature and API may change in the future.
   *
   * @see [Nitro route rules documentation](https://nitro.unjs.io/config/#routerules)
   */
  routeRules: NitroConfig['routeRules']

  /**
   * Nitro server handlers.
   *
   * Each handler accepts the following options:
   * - handler: The path to the file defining the handler. - route: The route under which the handler is available. This follows the conventions of [rou3](https://github.com/unjs/rou3). - method: The HTTP method of requests that should be handled. - middleware: Specifies whether it is a middleware handler. - lazy: Specifies whether to use lazy loading to import the handler.
   *
   * @see [`server/` directory documentation](https://nuxt.com/docs/guide/directory-structure/server)
   *
   * @note Files from `server/api`, `server/middleware` and `server/routes` will be automatically registered by Nuxt.
   *
   * @example
   * ```js
   * serverHandlers: [
   *   { route: '/path/foo/**:name', handler: '~/server/foohandler.ts' }
   * ]
   * ```
   */
  serverHandlers: NitroEventHandler[]

  /**
   * Nitro development-only server handlers.
   *
   * @see [Nitro server routes documentation](https://nitro.unjs.io/guide/routing)
   */
  devServerHandlers: NitroDevEventHandler[]

  postcss: {
  /**
   * A strategy for ordering PostCSS plugins.
   */
    order: 'cssnanoLast' | 'autoprefixerLast' | 'autoprefixerAndCssnanoLast' | string[] | ((names: string[]) => string[])

    /**
     * Options for configuring PostCSS plugins.
     *
     * @see [PostCSS docs](https://postcss.org/)
     */
    plugins: Record<string, unknown> & { autoprefixer?: Options0, cssnano?: Options1 }
  }

  router: {
  /**
   * Additional router options passed to `vue-router`. On top of the options for `vue-router`, Nuxt offers additional options to customize the router (see below).
   *
   * @note Only JSON serializable options should be passed by Nuxt config.
   * For more control, you can use `app/router.options.ts` file.
   *
   * @see [Vue Router documentation](https://router.vuejs.org/api/interfaces/routeroptions.html).
   */
    options: RouterConfigSerializable
  }

  /**
   * Configuration for Nuxt's TypeScript integration.
   */
  typescript: {
  /**
   * TypeScript comes with certain checks to give you more safety and analysis of your program. Once you’ve converted your codebase to TypeScript, you can start enabling these checks for greater safety. [Read More](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html#getting-stricter-checks)
   *
   * @default true
   */
    strict: boolean

    /**
     * Which builder types to include for your project.
     *
     * By default Nuxt infers this based on your `builder` option (defaulting to 'vite') but you can either turn off builder environment types (with `false`) to handle this fully yourself, or opt for a 'shared' option.
     * The 'shared' option is advised for module authors, who will want to support multiple possible builders.
     *
     */
    builder: 'vite' | 'webpack' | 'rspack' | 'shared' | false | undefined | null

    /**
     * Modules to generate deep aliases for within `compilerOptions.paths`. This does not yet support subpaths. It may be necessary when using Nuxt within a pnpm monorepo with `shamefully-hoist=false`.
     *
     * @default ["nitro/types","nitro/runtime","defu","h3","consola","ofetch","@unhead/vue","@nuxt/devtools","vue","@vue/runtime-core","@vue/compiler-sfc","vue-router","vue-router/auto-routes","unplugin-vue-router/client","@nuxt/schema","nuxt"]
     */
    hoist: Array<string>

    /**
     * Include parent workspace in the Nuxt project. Mostly useful for themes and module authors.
     *
     * @default false
     */
    includeWorkspace: boolean

    /**
     * Enable build-time type checking.
     *
     * If set to true, this will type check in development. You can restrict this to build-time type checking by setting it to `build`. Requires to install `typescript` and `vue-tsc` as dev dependencies.
     *
     * @default false
     *
     * @see [Nuxt TypeScript docs](https://nuxt.com/docs/guide/concepts/typescript)
     */
    typeCheck: boolean | 'build'

    /**
     * You can extend generated `.nuxt/tsconfig.json` using this option.
     *
     */
    tsConfig: 0 extends 1 & RawVueCompilerOptions ? TSConfig : TSConfig & { vueCompilerOptions?: RawVueCompilerOptions }

    /**
     * Generate a `*.vue` shim.
     *
     * We recommend instead letting the [official Vue extension](https://marketplace.visualstudio.com/items?itemName=Vue.volar) generate accurate types for your components.
     * Note that you may wish to set this to `true` if you are using other libraries, such as ESLint, that are unable to understand the type of `.vue` files.
     *
     * @default false
     */
    shim: boolean
  }

  esbuild: {
  /**
   * Configure shared esbuild options used within Nuxt and passed to other builders, such as Vite or Webpack.
   */
    options: import('esbuild').TransformOptions
  }

  /**
   * Configuration that will be passed directly to Vite.
   *
   * @see [Vite configuration docs](https://vite.dev/config) for more information.
   * Please note that not all vite options are supported in Nuxt.
   */
  vite: ViteConfig & { $client?: ViteConfig, $server?: ViteConfig }

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
   */
    analyze: boolean | { enabled?: boolean } & BundleAnalyzerPlugin.Options

    /**
     * Enable the profiler in webpackbar.
     *
     * It is normally enabled by CLI argument `--profile`.
     *
     * @default false
     *
     * @see [webpackbar](https://github.com/unjs/webpackbar#profile).
     */
    profile: boolean

    /**
     * Enables Common CSS Extraction.
     *
     * Using [mini-css-extract-plugin](https://github.com/webpack-contrib/mini-css-extract-plugin) under the hood, your CSS will be extracted into separate files, usually one per component. This allows caching your CSS and JavaScript separately.
     *
     * @default true
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
     */
    extractCSS: boolean | PluginOptions

    /**
     * Enables CSS source map support (defaults to `true` in development).
     *
     * @default false
     */
    cssSourceMap: boolean

    /**
     * The polyfill library to load to provide URL and URLSearchParams.
     *
     * Defaults to `'url'` ([see package](https://www.npmjs.com/package/url)).
     *
     * @default "url"
     */
    serverURLPolyfill: string

    /**
     * Customize bundle filenames.
     *
     * To understand a bit more about the use of manifests, take a look at [webpack documentation](https://webpack.js.org/guides/code-splitting/).
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
    filenames:
    Record<string, string | ((
      ctx: {
        nuxt: Nuxt
        options: NuxtOptions
        name: string
        isDev: boolean
        isServer: boolean
        isClient: boolean
        alias: { [index: string]: string | false | string[] }
        transpile: RegExp[]
      }) => string)
    >

    /**
     * Customize the options of Nuxt's integrated webpack loaders.
     *
     */
    loaders: {
      /**
       * @see [esbuild loader](https://github.com/esbuild-kit/esbuild-loader)
       */
      esbuild: Omit<LoaderOptions, 'loader'>

      /**
       * @see [`file-loader` Options](https://github.com/webpack-contrib/file-loader#options)
       *
       * @default
       * ```ts
       * { esModule: false }
       * ```
       */
      file: {
        /** @default false */
        esModule: boolean

        /** @default 1000 */
        limit: number
      }

      /**
       * @see [`file-loader` Options](https://github.com/webpack-contrib/file-loader#options)
       *
       * @default
       * ```ts
       * { esModule: false }
       * ```
       */
      fontUrl: {
        /** @default false */
        esModule: boolean

        /** @default 1000 */
        limit: number
      }

      /**
       * @see [`file-loader` Options](https://github.com/webpack-contrib/file-loader#options)
       *
       * @default
       * ```ts
       * { esModule: false }
       * ```
       */
      imgUrl: {
        /** @default false */
        esModule: boolean

        /** @default 1000 */
        limit: number
      }

      /**
       * @see [`pug` options](https://pugjs.org/api/reference.html#options)
       */
      pugPlain: Options2

      /**
       * See [vue-loader](https://github.com/vuejs/vue-loader) for available options.
       */
      vue: Partial<VueLoaderOptions>

      /**
       * See [css-loader](https://github.com/webpack-contrib/css-loader) for available options.
       */
      css: {
        /** @default 0 */
        importLoaders: number

        url: boolean | { filter: (url: string, resourcePath: string) => boolean }

        /** @default false */
        esModule: boolean
      }

      /**
       * See [css-loader](https://github.com/webpack-contrib/css-loader) for available options.
       */
      cssModules: {
        /** @default 0 */
        importLoaders: number

        url: boolean | { filter: (url: string, resourcePath: string) => boolean }

        /** @default false */
        esModule: boolean

        modules: {
          /** @default "[local]_[hash:base64:5]" */
          localIdentName: string
        }
      }

      /**
       * @see [`less-loader` Options](https://github.com/webpack-contrib/less-loader#options)
       */
      less: any

      /**
       * @see [`sass-loader` Options](https://github.com/webpack-contrib/sass-loader#options)
       *
       * @default
       * ```ts
       * {
       *   sassOptions: {
       *     indentedSyntax: true
       *   }
       * }
       * ```
       */
      sass: {
        sassOptions: {
          /** @default true */
          indentedSyntax: boolean
        }
      }

      /**
       * @see [`sass-loader` Options](https://github.com/webpack-contrib/sass-loader#options)
       */
      scss: any

      /**
       * @see [`stylus-loader` Options](https://github.com/webpack-contrib/stylus-loader#options)
       */
      stylus: any

      vueStyle: any
    }

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
    plugins: Array<any>

    /**
     * Hard-replaces `typeof process`, `typeof window` and `typeof document` to tree-shake bundle.
     *
     * @default false
     */
    aggressiveCodeRemoval: boolean

    /**
     * OptimizeCSSAssets plugin options.
     *
     * Defaults to true when `extractCSS` is enabled.
     *
     * @default false
     *
     * @see [css-minimizer-webpack-plugin documentation](https://github.com/webpack-contrib/css-minimizer-webpack-plugin).
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    optimizeCSS: false | BasePluginOptions & DefinedDefaultMinimizerAndOptions<{}>

    /**
     * Configure [webpack optimization](https://webpack.js.org/configuration/optimization/).
     *
     */
    optimization: false | Configuration['optimization']

    /**
     * Customize PostCSS Loader. same options as [`postcss-loader` options](https://github.com/webpack-contrib/postcss-loader#options)
     *
     */
    postcss: { execute?: boolean, postcssOptions: ProcessOptions & { plugins: Record<string, unknown> & { autoprefixer?: Options0, cssnano?: Options1 } }, sourceMap?: boolean, implementation?: any }

    /**
     * See [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware) for available options.
     *
     */
    devMiddleware: Options3<IncomingMessage, ServerResponse>

    /**
     * See [webpack-hot-middleware](https://github.com/webpack-contrib/webpack-hot-middleware) for available options.
     *
     */
    hotMiddleware: MiddlewareOptions & { client?: ClientOptions }

    /**
     * Set to `false` to disable the overlay provided by [FriendlyErrorsWebpackPlugin](https://github.com/nuxt/friendly-errors-webpack-plugin).
     *
     * @default true
     */
    friendlyErrors: boolean

    /**
     * Filters to hide build warnings.
     *
     */
    warningIgnoreFilters: Array<(warn: WebpackError) => boolean>

    /**
     * Configure [webpack experiments](https://webpack.js.org/configuration/experiments/)
     *
     */
    experiments: false | Configuration['experiments']
  }
}
