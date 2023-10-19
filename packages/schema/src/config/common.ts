import { defineUntypedSchema } from 'untyped'
import { join, relative, resolve } from 'pathe'
import { isDebug, isDevelopment } from 'std-env'
import { defu } from 'defu'
import { findWorkspaceDir } from 'pkg-types'
import type { RuntimeConfig } from '../types/config'

export default defineUntypedSchema({
  /**
   * Extend project from multiple local or remote sources.
   *
   * Value should be either a string or array of strings pointing to source directories or config path relative to current config.
   *
   * You can use `github:`, `gh:` `gitlab:` or `bitbucket:`.
   * @see https://github.com/unjs/c12#extending-config-layer-from-remote-sources
   * @see https://github.com/unjs/giget
   * @type {(string|string|[string, typeof import('c12').SourceOptions?])[]}
   */
  extends: null,

  /**
   * Extend project from a local or remote source.
   *
   * Value should be a string pointing to source directory or config path relative to current config.
   *
   * You can use `github:`, `gitlab:`, `bitbucket:` or `https://` to extend from a remote git repository.
   * @type {string}
   */
  theme: null,

  /**
   * Define the root directory of your application.
   *
   * This property can be overwritten (for example, running `nuxt ./my-app/`
   * will set the `rootDir` to the absolute path of `./my-app/` from the
   * current/working directory.
   *
   * It is normally not needed to configure this option.
   */
  rootDir: {
    $resolve: val => typeof val === 'string' ? resolve(val) : process.cwd()
  },

  /**
   * Define the workspace directory of your application.
   *
   * Often this is used when in a monorepo setup. Nuxt will attempt to detect
   * your workspace directory automatically, but you can override it here.
   *
   * It is normally not needed to configure this option.
   */
  workspaceDir: {
    $resolve: async (val, get) => val ? resolve(await get('rootDir'), val) : await findWorkspaceDir(await get('rootDir')).catch(() => get('rootDir'))
  },

  /**
   * Define the source directory of your Nuxt application.
   *
   * If a relative path is specified, it will be relative to the `rootDir`.
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
   * ------| static/
   * ------| store/
   * ------| server/
   * ------| app.config.ts
   * ------| app.vue
   * ------| error.vue
   * ```
   */
  srcDir: {
    $resolve: async (val, get) => resolve(await get('rootDir'), val || '.')
  },

  /**
   * Define the server directory of your Nuxt application, where Nitro
   * routes, middleware and plugins are kept.
   *
   * If a relative path is specified, it will be relative to your `rootDir`.
   *
   */
  serverDir: {
    $resolve: async (val, get) => resolve(await get('rootDir'), val || resolve(await get('srcDir'), 'server'))
  },

  /**
   * Define the directory where your built Nuxt files will be placed.
   *
   * Many tools assume that `.nuxt` is a hidden directory (because it starts
   * with a `.`). If that is a problem, you can use this option to prevent that.
   * @example
   * ```js
   * export default {
   *   buildDir: 'nuxt-build'
   * }
   * ```
   */
  buildDir: {
    $resolve: async (val, get) => resolve(await get('rootDir'), val || '.nuxt')
  },

  /**
   * Used to set the modules directories for path resolving (for example, webpack's
   * `resolveLoading`, `nodeExternals` and `postcss`).
   *
   * The configuration path is relative to `options.rootDir` (default is current working directory).
   *
   * Setting this field may be necessary if your project is organized as a yarn workspace-styled mono-repository.
   * @example
   * ```js
   * export default {
   *   modulesDir: ['../../node_modules']
   * }
   * ```
   */
  modulesDir: {
    $default: ['node_modules'],
    $resolve: async (val, get) => [
      ...await Promise.all(val.map(async (dir: string) => resolve(await get('rootDir'), dir))),
      resolve(process.cwd(), 'node_modules')
    ]
  },

  /**
   * The directory where Nuxt will store the generated files when running `nuxt analyze`.
   *
   * If a relative path is specified, it will be relative to your `rootDir`.
   */
  analyzeDir: {
    $resolve: async (val, get) => val
      ? resolve(await get('rootDir'), val)
      : resolve(await get('buildDir'), 'analyze')
  },

  /**
   * Whether Nuxt is running in development mode.
   *
   * Normally, you should not need to set this.
   */
  dev: Boolean(isDevelopment),

  /**
   * Whether your app is being unit tested.
   */
  test: Boolean(isDevelopment),

  /**
   * Set to `true` to enable debug mode.
   *
   * At the moment, it prints out hook names and timings on the server, and
   * logs hook arguments as well in the browser.
   *
   */
  debug: {
    $resolve: val => val ?? isDebug
  },

  /**
   * Whether to enable rendering of HTML - either dynamically (in server mode) or at generate time.
   * If set to `false` generated pages will have no content.
   */
  ssr: {
    $resolve: val => val ?? true
  },

  /**
   * Modules are Nuxt extensions which can extend its core functionality and add endless integrations.
   *
   * Each module is either a string (which can refer to a package, or be a path to a file), a
   * tuple with the module as first string and the options as a second object, or an inline module function.
   *
   * Nuxt tries to resolve each item in the modules array using node require path
   * (in `node_modules`) and then will be resolved from project `srcDir` if `~` alias is used.
   * @note Modules are executed sequentially so the order is important.
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
   * @type {(typeof import('../src/types/module').NuxtModule | string | [typeof import('../src/types/module').NuxtModule | string, Record<string, any>] | undefined | null | false)[]}
   */
  modules: {
    $resolve: val => [].concat(val).filter(Boolean)
  },

  /**
   * Customize default directory structure used by Nuxt.
   *
   * It is better to stick with defaults unless needed.
   */
  dir: {
    /**
     * The assets directory (aliased as `~assets` in your build).
     */
    assets: 'assets',

    /**
     * The layouts directory, each file of which will be auto-registered as a Nuxt layout.
     */
    layouts: 'layouts',

    /**
     * The middleware directory, each file of which will be auto-registered as a Nuxt middleware.
     */
    middleware: 'middleware',

    /**
     * The modules directory, each file in which will be auto-registered as a Nuxt module.
     */
    modules: 'modules',

    /**
     * The directory which will be processed to auto-generate your application page routes.
     */
    pages: 'pages',

    /**
     * The plugins directory, each file of which will be auto-registered as a Nuxt plugin.
     */
    plugins: 'plugins',

    /**
     * The directory containing your static files, which will be directly accessible via the Nuxt server
     * and copied across into your `dist` folder when your app is generated.
     */
    public: {
      $resolve: async (val, get) => val || await get('dir.static') || 'public'
    },

    static: {
      $schema: { deprecated: 'use `dir.public` option instead' },
      $resolve: async (val, get) => val || await get('dir.public') || 'public'
    }
  },

  /**
   * The extensions that should be resolved by the Nuxt resolver.
   */
  extensions: {
    $resolve: val => ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.vue'].concat(val).filter(Boolean)
  },

  /**
   * You can improve your DX by defining additional aliases to access custom directories
   * within your JavaScript and CSS.
   * @note Within a webpack context (image sources, CSS - but not JavaScript) you _must_ access
   * your alias by prefixing it with `~`.
   * @note These aliases will be automatically added to the generated `.nuxt/tsconfig.json` so you can get full
   * type support and path auto-complete. In case you need to extend options provided by `./.nuxt/tsconfig.json`
   * further, make sure to add them here or within the `typescript.tsConfig` property in `nuxt.config`.
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
   * @type {Record<string, string>}
   */
  alias: {
    $resolve: async (val, get) => ({
      '~': await get('srcDir'),
      '@': await get('srcDir'),
      '~~': await get('rootDir'),
      '@@': await get('rootDir'),
      [await get('dir.assets')]: join(await get('srcDir'), await get('dir.assets')),
      [await get('dir.public')]: join(await get('srcDir'), await get('dir.public')),
      ...val
    })
  },

  /**
   * Pass options directly to `node-ignore` (which is used by Nuxt to ignore files).
   * @see [node-ignore](https://github.com/kaelzhang/node-ignore)
   * @example
   * ```js
   * ignoreOptions: {
   *   ignorecase: false
   * }
   * ```
   */
  ignoreOptions: undefined,

  /**
   * Any file in `pages/`, `layouts/`, `middleware/` or `store/` will be ignored during
   * building if its filename starts with the prefix specified by `ignorePrefix`.
   */
  ignorePrefix: {
    $resolve: val => val ?? '-'
  },

  /**
   * More customizable than `ignorePrefix`: all files matching glob patterns specified
   * inside the `ignore` array will be ignored in building.
   */
  ignore: {
    $resolve: async (val, get) => [
      '**/*.stories.{js,cts,mts,ts,jsx,tsx}', // ignore storybook files
      '**/*.{spec,test}.{js,cts,mts,ts,jsx,tsx}', // ignore tests
      '**/*.d.{cts,mts,ts}', // ignore type declarations
      '**/.{pnpm-store,vercel,netlify,output,git,cache,data}',
      relative(await get('rootDir'), await get('analyzeDir')),
      relative(await get('rootDir'), await get('buildDir')),
      await get('ignorePrefix') && `**/${await get('ignorePrefix')}*.*`
    ].concat(val).filter(Boolean)
  },

  /**
   * The watch property lets you define patterns that will restart the Nuxt dev server when changed.
   *
   * It is an array of strings or regular expressions. Strings should be either absolute paths or
   * relative to the `srcDir` (and the `srcDir` of any layers). Regular expressions will be matched
   * against the path relative to the project `srcDir` (and the `srcDir` of any layers).
   * @type {Array<string | RegExp>}
   */
  watch: {
    $resolve: val => [].concat(val).filter((b: unknown) => typeof b === 'string' || b instanceof RegExp)
  },

  /**
   * The watchers property lets you overwrite watchers configuration in your `nuxt.config`.
   */
  watchers: {
    /** An array of event types, which, when received, will cause the watcher to restart. */
    rewatchOnRawEvents: undefined,
    /**
     * `watchOptions` to pass directly to webpack.
     * @see [webpack@4 watch options](https://v4.webpack.js.org/configuration/watch/#watchoptions).
     */
    webpack: {
      aggregateTimeout: 1000
    },
    /**
     * Options to pass directly to `chokidar`.
     * @see [chokidar](https://github.com/paulmillr/chokidar#api)
     */
    chokidar: {
      ignoreInitial: true
    }
  },

  /**
   * Hooks are listeners to Nuxt events that are typically used in modules,
   * but are also available in `nuxt.config`.
   *
   * Internally, hooks follow a naming pattern using colons (e.g., build:done).
   *
   * For ease of configuration, you can also structure them as an hierarchical
   * object in `nuxt.config` (as below).
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
   * variable `NUXT_API_KEY=my-api-key NUXT_PUBLIC_BASE_URL=/foo/` would overwrite the two values in the example below.
   * @example
   * ```js
   * export default {
   *  runtimeConfig: {
   *     apiKey: '' // Default to an empty string, automatically set at runtime using process.env.NUXT_API_KEY
   *     public: {
   *        baseURL: '' // Exposed to the frontend as well.
   *     }
   *   }
   * }
   * ```
   * @type {typeof import('../src/types/config').RuntimeConfig}
   */
  runtimeConfig: {
    $resolve: async (val: RuntimeConfig, get) => {
      provideFallbackValues(val)
      return defu(val, {
        public: {},
        app: {
          baseURL: (await get('app')).baseURL,
          buildAssetsDir: (await get('app')).buildAssetsDir,
          cdnURL: (await get('app')).cdnURL
        }
      })
    }
  },

  /**
   * Additional app configuration
   *
   * For programmatic usage and type support, you can directly provide app config with this option.
   * It will be merged with `app.config` file as default value.
   * @type {typeof import('../src/types/config').AppConfig}
   */
  appConfig: {
    nuxt: {}
  },

  $schema: {}
})

function provideFallbackValues (obj: Record<string, any>) {
  for (const key in obj) {
    if (typeof obj[key] === 'undefined' || obj[key] === null) {
      obj[key] = ''
    } else if (typeof obj[key] === 'object') {
      provideFallbackValues(obj[key])
    }
  }
}
