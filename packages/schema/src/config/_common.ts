import { join, resolve } from 'pathe'
import { isDevelopment } from 'std-env'
import createRequire from 'create-require'
import { pascalCase } from 'scule'
import jiti from 'jiti'
import defu from 'defu'
import { RuntimeConfig } from '../types/config'

export default {
  /**
   * Extend nested configurations from multiple local or remote sources
   *
   * Value should be either a string or array of strings pointing to source directories or config path relative to current config.
   *
   * You can use `github:`, `gitlab:`, `bitbucket:` or `https://` to extend from a remote git repository.
   *
   * @type {string|string[]}
   *
   * @version 3
   */
  extends: null,

  /**
   * Define the workspace directory of your application.
   *
   * This property can be overwritten (for example, running `nuxt ./my-app/`
   * will set the `rootDir` to the absolute path of `./my-app/` from the
   * current/working directory.
   *
   * It is normally not needed to configure this option.
   * @version 2
   * @version 3
   */
  rootDir: {
    $resolve: val => typeof val === 'string' ? resolve(val) : process.cwd()
  },

  /**
   * Define the source directory of your Nuxt application.
   *
   * If a relative path is specified it will be relative to the `rootDir`.
   *
   * @example
   * ```js
   * export default {
   *   srcDir: 'client/'
   * }
   * ```
   * This would work with the following folder structure:
   * ```bash
   * -| app/
   * ---| node_modules/
   * ---| nuxt.config.js
   * ---| package.json
   * ---| client/
   * ------| assets/
   * ------| components/
   * ------| layouts/
   * ------| middleware/
   * ------| pages/
   * ------| plugins/
   * ------| static/
   * ------| store/
   * ```
   * @version 2
   * @version 3
   */
  srcDir: {
    $resolve: (val, get) => resolve(get('rootDir'), val || '.')
  },

  /**
   * Define the directory where your built Nuxt files will be placed.
   *
   * Many tools assume that `.nuxt` is a hidden directory (because it starts
   * with a `.`). If that is a problem, you can use this option to prevent that.
   *
   * @example
   * ```js
   * export default {
   *   buildDir: 'nuxt-build'
   * }
   * ```
   * @version 2
   * @version 3
   */
  buildDir: {
    $resolve: (val, get) => resolve(get('rootDir'), val || '.nuxt')
  },

  /**
   * Whether Nuxt is running in development mode.
   *
   * Normally you should not need to set this.
   * @version 2
   * @version 3
   */
  dev: Boolean(isDevelopment),

  /**
   * Whether your app is being unit tested
   * @version 2
   */
  test: Boolean(isDevelopment),

  /**
   * Set to true to enable debug mode.
   *
   * By default it's only enabled in development mode.
   * @version 2
   */
  debug: {
    $resolve: (val, get) => val ?? get('dev')
  },

  /**
   * The env property defines environment variables that should be available
   * throughout your app (server- and client-side). They can be assigned using
   * server side environment variables.
   *
   * @note Nuxt uses webpack's `definePlugin` to define these environment variables.
   * This means that the actual `process` or `process.env` from Node.js is neither
   * available nor defined. Each of the `env` properties defined here is individually
   * mapped to `process.env.xxxx` and converted during compilation.
   *
   * @note Environment variables starting with `NUXT_ENV_` are automatically injected
   * into the process environment.
   *
   * @version 2
   */
  env: {
    $default: {},
    $resolve: (val) => {
      val = { ...val }
      for (const key in process.env) {
        if (key.startsWith('NUXT_ENV_')) {
          val[key] = process.env[key]
        }
      }
      return val
    }
  },

  /**
   * Set the method Nuxt uses to require modules, such as loading `nuxt.config`, server
   * middleware, and so on - defaulting to `jiti` (which has support for TypeScript and ESM syntax).
   *
   * @see [jiti](https://github.com/unjs/jiti)
   * @type {'jiti' | 'native' | ((p: string | { filename: string }) => NodeRequire)}
   * @version 2
   */
  createRequire: {
    $resolve: (val: any) => {
      val = process.env.NUXT_CREATE_REQUIRE || val ||
        (typeof globalThis.jest !== 'undefined' ? 'native' : 'jiti')
      if (val === 'jiti') {
        return p => jiti(typeof p === 'string' ? p : p.filename)
      }
      if (val === 'native') {
        return p => createRequire(typeof p === 'string' ? p : p.filename)
      }
      return val
    }
  },

  /**
   * Whether your Nuxt app should be built to be served by the Nuxt server (`server`)
   * or as static HTML files suitable for a CDN or other static file server (`static`).
   *
   * This is unrelated to `ssr`.
   * @type {'server' | 'static'}
   * @version 2
   */
  target: {
    $resolve: val => ['server', 'static'].includes(val) ? val : 'server'
  },

  /**
   * Whether to enable rendering of HTML - either dynamically (in server mode) or at generate time.
   * If set to `false` and combined with `static` target, generated pages will simply display
   * a loading screen with no content.
   * @version 2
   * @version 3
   */
  ssr: true,

  /**
   * @deprecated use ssr option
   */
  mode: {
    $resolve: (val, get) => val || (get('ssr') ? 'spa' : 'universal'),
    $schema: { deprecated: '`mode` option is deprecated' }
  },

  /**
   * Whether to produce a separate modern build targeting browsers that support ES modules.
   *
   * Set to `'server'` to enable server mode, where the Nuxt server checks
   * browser version based on the user agent and serves the correct bundle.
   *
   * Set to `'client'` to serve both the modern bundle with `<script type="module">`
   * and the legacy bundle with `<script nomodule>`. It will also provide a
   * `<link rel="modulepreload">` for the modern bundle. Every browser that understands
   * the module type will load the modern bundle while older browsers fall back to the
   * legacy (transpiled) bundle.
   *
   * If you have set `modern: true` and are generating your app or have `ssr: false`,
   * modern will be set to `'client'`.
   *
   * If you have set `modern: true` and are serving your app, modern will be set to `'server'`.
   *
   * @see [concept of modern mode](https://philipwalton.com/articles/deploying-es2015-code-in-production-today/)
   * @type {'server' | 'client' | boolean}
   * @version 2
   */
  modern: undefined,

  /**
   * Modules are Nuxt extensions which can extend its core functionality and add endless integrations
   *
   * Each module is either a string (which can refer to a package, or be a path to a file), a
   * tuple with the module as first string and the options as a second object, or an inline module function.
   *
   * Nuxt tries to resolve each item in the modules array using node require path
   * (in `node_modules`) and then will be resolved from project `srcDir` if `~` alias is used.
   *
   * @note Modules are executed sequentially so the order is important.
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
   * @type {(typeof import('../src/types/module').NuxtModule | string | [typeof import('../src/types/module').NuxtModule | string, Record<string, any>])[]}
   * @version 2
   * @version 3
   */
  modules: [],

  /**
   * Modules that are only required during development and build time.
   *
   * Modules are Nuxt extensions which can extend its core functionality and add endless integrations
   *
   * Each module is either a string (which can refer to a package, or be a path to a file), a
   * tuple with the module as first string and the options as a second object, or an inline module function.
   *
   * Nuxt tries to resolve each item in the modules array using node require path
   * (in `node_modules`) and then will be resolved from project `srcDir` if `~` alias is used.
   *
   * @note Modules are executed sequentially so the order is important.
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
   *
   * @note In Nuxt 2, using `buildModules` helps to make production startup faster and also significantly
   * decreases the size of `node_modules` in production deployments. Please refer to each
   * module's documentation to see if it is recommended to use `modules` or `buildModules`.
   *
   * @type {(typeof import('../src/types/module').NuxtModule | string | [typeof import('../src/types/module').NuxtModule | string, Record<string, any>])[]}
   * @version 2
   * @deprecated This is no longer needed in Nuxt 3 and Nuxt Bridge; all modules should be added to `modules` instead.
   */
  buildModules: [],

  /**
   * Built-in ad-hoc modules
   *
   *  @private
   */
  _modules: [],

  /**
   * Installed module metadata
   *
   * @version 3
   * @private
  */
  _installedModules: [],

  /**
   * Allows customizing the global ID used in the main HTML template as well as the main
   * Vue instance name and other options.
   * @version 2
   */
  globalName: {
    $resolve: val => (typeof val === 'string' && /^[a-zA-Z]+$/.test(val)) ? val.toLocaleLowerCase() : 'nuxt'
  },

  /**
   * Customizes specific global names (they are based on `globalName` by default).
   * @version 2
   */
  globals: {
    /** @type {(globalName: string) => string} */
    id: globalName => `__${globalName}`,
    /** @type {(globalName: string) => string} */
    nuxt: globalName => `$${globalName}`,
    /** @type {(globalName: string) => string} */
    context: globalName => `__${globalName.toUpperCase()}__`,
    /** @type {(globalName: string) => string} */
    pluginPrefix: globalName => globalName,
    /** @type {(globalName: string) => string} */
    readyCallback: globalName => `on${pascalCase(globalName)}Ready`,
    /** @type {(globalName: string) => string} */
    loadedCallback: globalName => `_on${pascalCase(globalName)}Loaded`
  },

  /**
   * Server middleware are connect/express/h3-shaped functions that handle server-side requests. They
   * run on the server and before the Vue renderer.
   *
   * By adding entries to `serverMiddleware` you can register additional routes without the need
   * for an external server.
   *
   * You can pass a string, which can be the name of a node dependency or a path to a file. You
   * can also pass an object with `path` and `handler` keys. (`handler` can be a path or a
   * function.)
   *
   * @note If you pass a function directly, it will only run in development mode.
   *
   * @example
   * ```js
   * serverMiddleware: [
   *   // Will register redirect-ssl npm package
   *   'redirect-ssl',
   *   // Will register file from project server-middleware directory to handle /server-middleware/* requires
   *   { path: '/server-middleware', handler: '~/server-middleware/index.js' },
   *   // We can create custom instances too, but only in development mode, they are ignored for the production bundle.
   *   { path: '/static2', handler: serveStatic(fileURLToPath(new URL('./static2', import.meta.url))) }
   * ]
   * ```
   *
   * @note If you don't want middleware to run on all routes you should use the object
   * form with a specific path.
   *
   * If you pass a string handler, Nuxt will expect that file to export a default function
   * that handles `(req, res, next) => void`.
   *
   * @example
   * ```js
   * export default function (req, res, next) {
   *   // req is the Node.js http request object
   *   console.log(req.url)
   *   // res is the Node.js http response object
   *   // next is a function to call to invoke the next middleware
   *   // Don't forget to call next at the end if your middleware is not an endpoint!
   *   next()
   * }
   * ```
   *
   * Alternatively, it can export a connect/express/h3-type app instance.
   * @example
   * ```js
   * import bodyParser from 'body-parser'
   * import createApp from 'express'
   * const app = createApp()
   * app.use(bodyParser.json())
   * app.all('/getJSON', (req, res) => {
   *   res.json({ data: 'data' })
   * })
   * export default app
   * ```
   *
   * Alternatively, instead of passing an array of `serverMiddleware`, you can pass an object
   * whose keys are the paths and whose values are the handlers (string or function).
   * @example
   * ```js
   * export default {
   *   serverMiddleware: {
   *     '/a': '~/server-middleware/a.js',
   *     '/b': '~/server-middleware/b.js',
   *     '/c': '~/server-middleware/c.js'
   *   }
   * }
   * ```
   *
   * @version 2
   * @deprecated Use `serverHandlers` instead
   */
  serverMiddleware: {
    $resolve: (val: any) => {
      if (!val) {
        return []
      }
      if (!Array.isArray(val)) {
        return Object.entries(val).map(([path, handler]) => ({ path, handler }))
      }
      return val
    }
  },

  /**
   * Used to set the modules directories for path resolving (for example, webpack's
   * `resolveLoading`, `nodeExternals` and `postcss`).
   *
   * The configuration path is relative to `options.rootDir` (default is current working directory).
   *
   * Setting this field may be necessary if your project is organized as a yarn workspace-styled mono-repository.
   *
   * @example
   * ```js
   * export default {
   *   modulesDir: ['../../node_modules']
   * }
   * ```
   * @version 2
   */
  modulesDir: {
    $default: ['node_modules'],
    $resolve: (val, get) => [].concat(
      val.map(dir => resolve(get('rootDir'), dir)),
      resolve(process.cwd(), 'node_modules')
    )
  },

  /**
   * Customize default directory structure used by nuxt.
   *
   * It is better to stick with defaults unless needed.
   * @version 2
   * @version 3
   */
  dir: {
    /**
     * The assets directory (aliased as `~assets` in your build)
     * @version 2
     */
    assets: 'assets',
    /**
     * The directory containing app template files like `app.html` and `router.scrollBehavior.js`
     * @version 2
     */
    app: 'app',
    /**
     * The layouts directory, each file of which will be auto-registered as a Nuxt layout.
     * @version 2
     * @version 3
     */
    layouts: 'layouts',
    /**
     * The middleware directory, each file of which will be auto-registered as a Nuxt middleware.
     * @version 3
     * @version 2
     */
    middleware: 'middleware',
    /**
     * The directory which will be processed to auto-generate your application page routes.
     * @version 2
     * @version 3
     */
    pages: 'pages',
    /**
     * The directory containing your static files, which will be directly accessible via the Nuxt server
     * and copied across into your `dist` folder when your app is generated.
     * @version 3
     */
    public: {
      $resolve: (val, get) => val || get('dir.static') || 'public',
    },
    /** @version 2 */
    static: {
      $schema: { deprecated: 'use `dir.public` option instead' },
      $resolve: (val, get) => val || get('dir.public') || 'public',
    },
    /**
     * The folder which will be used to auto-generate your Vuex store structure.
     * @version 2
     */
    store: 'store'
  },

  /**
   * The extensions that should be resolved by the Nuxt resolver.
   * @version 2
   * @version 3
   */
  extensions: {
    $resolve: val => ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.vue'].concat(val).filter(Boolean)
  },

  /**
   * The style extensions that should be resolved by the Nuxt resolver (for example, in `css` property).
   * @version 2
   */
  styleExtensions: ['.css', '.pcss', '.postcss', '.styl', '.stylus', '.scss', '.sass', '.less'],

  /**
   * You can improve your DX by defining additional aliases to access custom directories
   * within your JavaScript and CSS.
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
   *
   * @type {Record<string, string>}
   * @version 2
   * @version 3
   */
  alias: {
    $resolve: (val, get) => ({
      '~~': get('rootDir'),
      '@@': get('rootDir'),
      '~': get('srcDir'),
      '@': get('srcDir'),
      [get('dir.assets')]: join(get('srcDir'), get('dir.assets')),
      [get('dir.public')]: join(get('srcDir'), get('dir.public')),
      ...val
    })
  },

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
   * @version 2
   * @version 3
   */
  ignoreOptions: undefined,

  /**
   * Any file in `pages/`, `layouts/`, `middleware/` or `store/` will be ignored during
   * building if its filename starts with the prefix specified by `ignorePrefix`.
   * @version 2
   * @version 3
   */
  ignorePrefix: '-',

  /**
   * More customizable than `ignorePrefix`: all files matching glob patterns specified
   * inside the `ignore` array will be ignored in building.
   * @version 2
   * @version 3
   */
  ignore: {
    $resolve: (val, get) => [
      '**/*.stories.{js,ts,jsx,tsx}', // ignore storybook files
      '**/*.{spec,test}.{js,ts,jsx,tsx}', // ignore tests
      '.output',
      get('ignorePrefix') && `**/${get('ignorePrefix')}*.*`
    ].concat(val).filter(Boolean)
  },

  /**
   * The watch property lets you watch custom files for restarting the server.
   *
   * `chokidar` is used to set up the watchers. To learn more about its pattern
   * options, see chokidar documentation.
   *
   * @see [chokidar](https://github.com/paulmillr/chokidar#api)
   *
   * @example
   * ```js
   * watch: ['~/custom/*.js']
   * ```
   * @type {string[]}
   * @version 2
   */
  watch: {
    $resolve: (val, get) => {
      const rootDir = get('rootDir')
      return Array.from(new Set([].concat(val, get('_nuxtConfigFiles'))
        .filter(Boolean).map(p => resolve(rootDir, p))
      ))
    }
  },

  /**
   * The watchers property lets you overwrite watchers configuration in your `nuxt.config`.
   * @version 2
   * @version 3
   */
  watchers: {
    /** An array of event types, which, when received, will cause the watcher to restart. */
    rewatchOnRawEvents: undefined,
    /**
     * `watchOptions` to pass directly to webpack.
     *
     * @see [webpack@4 watch options](https://v4.webpack.js.org/configuration/watch/#watchoptions).
     *  */
    webpack: {
      aggregateTimeout: 1000
    },
    /**
     * Options to pass directly to `chokidar`.
     *
     * @see [chokidar](https://github.com/paulmillr/chokidar#api)
     */
    chokidar: {
      ignoreInitial: true
    }
  },

  /**
   * Your preferred code editor to launch when debugging.
   *
   * @see [documentation](https://github.com/yyx990803/launch-editor#supported-editors)
   * @type {string}
   * @version 2
   */
  editor: undefined,

  /**
   * Hooks are listeners to Nuxt events that are typically used in modules,
   * but are also available in `nuxt.config`.
   *
   * Internally, hooks follow a naming pattern using colons (e.g., build:done).
   *
   * For ease of configuration, you can also structure them as an hierarchical
   * object in `nuxt.config` (as below).
   *
   * @example
   * ```js'node:fs'
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
   * @version 2
   * @version 3
   * @type {typeof import('../src/types/hooks').NuxtHooks}
   */
  hooks: null,

  /**
   * Runtime config allows passing dynamic config and environment variables to the Nuxt app context.
   *
   * The value of this object is accessible from server only using `useRuntimeConfig`.
   *
   * It mainly should hold _private_ configuration which is not exposed on the frontend.
   * This could include a reference to your API secret tokens.
   *
   * Anything under `public` and `app` will be exposed to the frontend as well.
   *
   * Values are automatically replaced by matching env variables at runtime, e.g. setting an environment
   * variable `API_KEY=my-api-key PUBLIC_BASE_URL=/foo/` would overwrite the two values in the example below.
   *
   * @example
   * ```js
   * export default {
   *  runtimeConfig: {
   *     apiKey: '' // Default to an empty string, automatically loaded at runtime using process.env.NUXT_API_SECRET
   *     public: {
   *        baseURL: '' // Exposed to the frontend as well.
   *     }
   *   }
   * }
   * ```
   * @type {typeof import('../src/types/config').RuntimeConfig}
   * @version 3
   */
  runtimeConfig: {
    $resolve: (val: RuntimeConfig, get) => defu(val, {
      ...get('publicRuntimeConfig'),
      ...get('privateRuntimeConfig'),
      public: get('publicRuntimeConfig'),
      app: {
        baseURL: get('app').baseURL,
        buildAssetsDir: get('app').buildAssetsDir,
        cdnURL: get('app').cdnURL,
      }
    })
  },

  /**
   * @type {typeof import('../src/types/config').PrivateRuntimeConfig}
   * @version 2
   * @version 3
   * @deprecated Use `runtimeConfig` option
   */
  privateRuntimeConfig: {},

  /**
   * @type {typeof import('../src/types/config').PublicRuntimeConfig}
   * @version 2
   * @version 3
   * @deprecated Use `runtimeConfig` option with `public` key (`runtimeConfig.public.*`)
   */
  publicRuntimeConfig: {}
}
