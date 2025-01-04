import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { defineUntypedSchema } from 'untyped'
import { basename, join, relative, resolve } from 'pathe'
import { isDebug, isDevelopment, isTest } from 'std-env'
import { defu } from 'defu'
import { findWorkspaceDir } from 'pkg-types'

import type { RuntimeConfig } from '../types/config'

export default defineUntypedSchema({
  /**
   * Extend project from multiple local or remote sources.
   *
   * Value should be either a string or array of strings pointing to source directories or config path relative to current config.
   *
   * You can use `github:`, `gh:` `gitlab:` or `bitbucket:`
   * @see [`c12` docs on extending config layers](https://github.com/unjs/c12#extending-config-layer-from-remote-sources)
   * @see [`giget` documentation](https://github.com/unjs/giget)
   * @type {string | [string, typeof import('c12').SourceOptions?] | (string | [string, typeof import('c12').SourceOptions?])[]}
   */
  extends: null,

  /**
   * Specify a compatibility date for your app.
   *
   * This is used to control the behavior of presets in Nitro, Nuxt Image
   * and other modules that may change behavior without a major version bump.
   *
   * We plan to improve the tooling around this feature in the future.
   *
   * @type {typeof import('compatx').CompatibilityDateSpec}
   */
  compatibilityDate: undefined,

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
    $resolve: val => typeof val === 'string' ? resolve(val) : process.cwd(),
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
    $resolve: async (val: string | undefined, get): Promise<string> => {
      const rootDir = await get('rootDir') as string
      return val ? resolve(rootDir, val) : await findWorkspaceDir(rootDir).catch(() => rootDir)
    },
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
   * ------| public/
   * ------| store/
   * ------| server/
   * ------| app.config.ts
   * ------| app.vue
   * ------| error.vue
   * ```
   */
  srcDir: {
    $resolve: async (val: string | undefined, get): Promise<string> => {
      if (val) {
        return resolve(await get('rootDir') as string, val)
      }

      const [rootDir, isV4] = await Promise.all([
        get('rootDir') as Promise<string>,
        (get('future') as Promise<Record<string, unknown>>).then(r => r.compatibilityVersion === 4),
      ])

      if (!isV4) {
        return rootDir
      }

      const srcDir = resolve(rootDir, 'app')
      if (!existsSync(srcDir)) {
        return rootDir
      }

      const srcDirFiles = new Set<string>()
      const files = await readdir(srcDir).catch(() => [])
      for (const file of files) {
        if (file !== 'spa-loading-template.html' && !file.startsWith('router.options')) {
          srcDirFiles.add(file)
        }
      }
      if (srcDirFiles.size === 0) {
        for (const file of ['app.vue', 'App.vue']) {
          if (existsSync(resolve(rootDir, file))) {
            return rootDir
          }
        }
        const keys = ['assets', 'layouts', 'middleware', 'pages', 'plugins'] as const
        const dirs = await Promise.all(keys.map(key => get(`dir.${key}`) as Promise<string>))
        for (const dir of dirs) {
          if (existsSync(resolve(rootDir, dir))) {
            return rootDir
          }
        }
      }
      return srcDir
    },
  },

  /**
   * Define the server directory of your Nuxt application, where Nitro
   * routes, middleware and plugins are kept.
   *
   * If a relative path is specified, it will be relative to your `rootDir`.
   *
   */
  serverDir: {
    $resolve: async (val: string | undefined, get): Promise<string> => {
      if (val) {
        const rootDir = await get('rootDir') as string
        return resolve(rootDir, val)
      }
      const isV4 = (await get('future') as Record<string, unknown>).compatibilityVersion === 4
      return join(isV4 ? await get('rootDir') as string : await get('srcDir') as string, 'server')
    },
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
    $resolve: async (val: string | undefined, get) => {
      const rootDir = await get('rootDir') as string
      return resolve(rootDir, val ?? '.nuxt')
    },
  },

  /**
   * For multi-app projects, the unique id of the Nuxt application.
   *
   * Defaults to `nuxt-app`.
   */
  appId: {
    $resolve: (val: string) => val ?? 'nuxt-app',
  },

  /**
   * A unique identifier matching the build. This may contain the hash of the current state of the project.
   */
  buildId: {
    $resolve: async (val: string | undefined, get): Promise<string> => {
      if (typeof val === 'string') { return val }

      const [isDev, isTest] = await Promise.all([get('dev') as Promise<boolean>, get('test') as Promise<boolean>])
      return isDev ? 'dev' : isTest ? 'test' : randomUUID()
    },
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
    $resolve: async (val: string[] | undefined, get): Promise<string[]> => {
      const rootDir = await get('rootDir') as string
      return [...new Set([
        ...(val || []).map((dir: string) => resolve(rootDir, dir)),
        resolve(rootDir, 'node_modules'),
      ])]
    },
  },

  /**
   * The directory where Nuxt will store the generated files when running `nuxt analyze`.
   *
   * If a relative path is specified, it will be relative to your `rootDir`.
   */
  analyzeDir: {
    $resolve: async (val: string | undefined, get): Promise<string> => val
      ? resolve(await get('rootDir') as string, val)
      : resolve(await get('buildDir') as string, 'analyze'),
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
  test: Boolean(isTest),

  /**
   * Set to `true` to enable debug mode.
   *
   * At the moment, it prints out hook names and timings on the server, and
   * logs hook arguments as well in the browser.
   *
   */
  debug: {
    $resolve: val => val ?? isDebug,
  },

  /**
   * Whether to enable rendering of HTML - either dynamically (in server mode) or at generate time.
   * If set to `false` generated pages will have no content.
   */
  ssr: {
    $resolve: val => val ?? true,
  },

  /**
   * Modules are Nuxt extensions which can extend its core functionality and add endless integrations.
   *
   * Each module is either a string (which can refer to a package, or be a path to a file), a
   * tuple with the module as first string and the options as a second object, or an inline module function.
   *
   * Nuxt tries to resolve each item in the modules array using node require path
   * (in `node_modules`) and then will be resolved from project `srcDir` if `~` alias is used.
   * @note Modules are executed sequentially so the order is important. First, the modules defined in `nuxt.config.ts` are loaded. Then, modules found in the `modules/`
   * directory are executed, and they load in alphabetical order.
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
   * @type {(typeof import('../src/types/module').NuxtModule<any> | string | [typeof import('../src/types/module').NuxtModule | string, Record<string, any>] | undefined | null | false)[]}
   */
  modules: {
    $resolve: (val: string[] | undefined): string[] => (val || []).filter(Boolean),
  },

  /**
   * Customize default directory structure used by Nuxt.
   *
   * It is better to stick with defaults unless needed.
   */
  dir: {
    app: {
      $resolve: async (val: string | undefined, get) => {
        const isV4 = (await get('future') as Record<string, unknown>).compatibilityVersion === 4
        if (isV4) {
          const [srcDir, rootDir] = await Promise.all([get('srcDir') as Promise<string>, get('rootDir') as Promise<string>])
          return resolve(await get('srcDir') as string, val || (srcDir === rootDir ? 'app' : '.'))
        }
        return val || 'app'
      },
    },
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
    modules: {
      $resolve: async (val: string | undefined, get) => {
        const isV4 = (await get('future') as Record<string, unknown>).compatibilityVersion === 4
        if (isV4) {
          return resolve(await get('rootDir') as string, val || 'modules')
        }
        return val || 'modules'
      },
    },

    /**
     * The directory which will be processed to auto-generate your application page routes.
     */
    pages: 'pages',

    /**
     * The plugins directory, each file of which will be auto-registered as a Nuxt plugin.
     */
    plugins: 'plugins',

    /**
     * The shared directory. This directory is shared between the app and the server.
     */
    shared: 'shared',

    /**
     * The directory containing your static files, which will be directly accessible via the Nuxt server
     * and copied across into your `dist` folder when your app is generated.
     */
    public: {
      $resolve: async (val: string | undefined, get) => {
        const isV4 = (await get('future') as Record<string, unknown>).compatibilityVersion === 4
        if (isV4) {
          return resolve(await get('rootDir') as string, val || await get('dir.static') as string || 'public')
        }
        return val || await get('dir.static') as string || 'public'
      },
    },

    static: {
      $schema: { deprecated: 'use `dir.public` option instead' },
      $resolve: async (val, get) => val || await get('dir.public') || 'public',
    },
  },

  /**
   * The extensions that should be resolved by the Nuxt resolver.
   */
  extensions: {
    $resolve: (val: string[] | undefined): string[] => ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.vue', ...val || []].filter(Boolean),
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
    $resolve: async (val: Record<string, string>, get): Promise<Record<string, string>> => {
      const [srcDir, rootDir, assetsDir, publicDir, buildDir, sharedDir] = await Promise.all([get('srcDir'), get('rootDir'), get('dir.assets'), get('dir.public'), get('buildDir'), get('dir.shared')]) as [string, string, string, string, string, string]
      return {
        '~': srcDir,
        '@': srcDir,
        '~~': rootDir,
        '@@': rootDir,
        '#shared': resolve(rootDir, sharedDir),
        [basename(assetsDir)]: resolve(srcDir, assetsDir),
        [basename(publicDir)]: resolve(srcDir, publicDir),
        '#build': buildDir,
        '#internal/nuxt/paths': resolve(buildDir, 'paths.mjs'),
        ...val,
      }
    },
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
   * @type {typeof import('ignore').Options}
   */
  ignoreOptions: undefined,

  /**
   * Any file in `pages/`, `layouts/`, `middleware/`, and `public/` directories will be ignored during
   * the build process if its filename starts with the prefix specified by `ignorePrefix`. This is intended to prevent
   * certain files from being processed or served in the built application.
   * By default, the `ignorePrefix` is set to '-', ignoring any files starting with '-'.
   */
  ignorePrefix: {
    $resolve: val => val ?? '-',
  },

  /**
   * More customizable than `ignorePrefix`: all files matching glob patterns specified
   * inside the `ignore` array will be ignored in building.
   */
  ignore: {
    $resolve: async (val: string[] | undefined, get): Promise<string[]> => {
      const [rootDir, ignorePrefix, analyzeDir, buildDir] = await Promise.all([get('rootDir'), get('ignorePrefix'), get('analyzeDir'), get('buildDir')]) as [string, string, string, string]
      return [
        '**/*.stories.{js,cts,mts,ts,jsx,tsx}', // ignore storybook files
        '**/*.{spec,test}.{js,cts,mts,ts,jsx,tsx}', // ignore tests
        '**/*.d.{cts,mts,ts}', // ignore type declarations
        '**/.{pnpm-store,vercel,netlify,output,git,cache,data}',
        relative(rootDir, analyzeDir),
        relative(rootDir, buildDir),
        ignorePrefix && `**/${ignorePrefix}*.*`,
        ...val || [],
      ].filter(Boolean)
    },
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
    $resolve: (val: Array<unknown> | undefined) => {
      return (val || []).filter((b: unknown) => typeof b === 'string' || b instanceof RegExp)
    },
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
      aggregateTimeout: 1000,
    },
    /**
     * Options to pass directly to `chokidar`.
     * @see [chokidar](https://github.com/paulmillr/chokidar#api)
     */
    chokidar: {
      ignoreInitial: true,
    },
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
   *     apiKey: '', // Default to an empty string, automatically set at runtime using process.env.NUXT_API_KEY
   *     public: {
   *        baseURL: '' // Exposed to the frontend as well.
   *     }
   *   }
   * }
   * ```
   * @type {typeof import('../src/types/config').RuntimeConfig}
   */
  runtimeConfig: {
    $resolve: async (val: RuntimeConfig, get): Promise<Record<string, unknown>> => {
      const [app, buildId] = await Promise.all([get('app') as Promise<Record<string, string>>, get('buildId') as Promise<string>])
      provideFallbackValues(val)
      return defu(val, {
        public: {},
        app: {
          buildId,
          baseURL: app.baseURL,
          buildAssetsDir: app.buildAssetsDir,
          cdnURL: app.cdnURL,
        },
      })
    },
  },

  /**
   * Additional app configuration
   *
   * For programmatic usage and type support, you can directly provide app config with this option.
   * It will be merged with `app.config` file as default value.
   * @type {typeof import('../src/types/config').AppConfig}
   */
  appConfig: {
    nuxt: {},
  },

  $schema: {},
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
