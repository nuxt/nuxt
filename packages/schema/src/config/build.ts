import { defu } from 'defu'
import { join } from 'pathe'
import { isTest } from 'std-env'
import { consola } from 'consola'
import type { Nuxt } from 'nuxt/schema'
import { defineResolvers } from '../utils/definition'

export default defineResolvers({
  /**
   * The builder to use for bundling the Vue part of your application.
   * @type {'vite' | 'webpack' | 'rspack' | { bundle: (nuxt: typeof import('../src/types/nuxt').Nuxt) => Promise<void> }}
   */
  builder: {
    $resolve: async (val, get) => {
      if (val && typeof val === 'object' && 'bundle' in val) {
        return val as { bundle: (nuxt: Nuxt) => Promise<void> }
      }
      const map = {
        rspack: '@nuxt/rspack-builder',
        vite: '@nuxt/vite-builder',
        webpack: '@nuxt/webpack-builder',
      }
      type Builder = 'vite' | 'webpack' | 'rspack'
      if (typeof val === 'string' && val in map) {
        // TODO: improve normalisation inference
        return map[val as keyof typeof map] as Builder
      }
      // @ts-expect-error TODO: remove old, unsupported config in v4
      if (await get('vite') === false) {
        return map.webpack as Builder
      }
      return map.vite as Builder
    },
  },

  /**
   * Configures whether and how sourcemaps are generated for server and/or client bundles.
   *
   * If set to a single boolean, that value applies to both server and client.
   * Additionally, the `'hidden'` option is also available for both server and client.
   *
   * Available options for both client and server:
   * - `true`: Generates sourcemaps and includes source references in the final bundle.
   * - `false`: Does not generate any sourcemaps.
   * - `'hidden'`: Generates sourcemaps but does not include references in the final bundle.
   *
   * @type {boolean | { server?: boolean | 'hidden', client?: boolean | 'hidden' }}
   */
  sourcemap: {
    $resolve: async (val, get) => {
      if (typeof val === 'boolean') {
        return { server: val, client: val }
      }
      return {
        server: true,
        client: await get('dev'),
        ...typeof val === 'object' ? val : {},
      }
    },
  },

  /**
   * Log level when building logs.
   *
   * Defaults to 'silent' when running in CI or when a TTY is not available.
   * This option is then used as 'silent' in Vite and 'none' in Webpack
   * @type {'silent' | 'info' | 'verbose'}
   */
  logLevel: {
    $resolve: (val) => {
      if (val && typeof val === 'string' && !['silent', 'info', 'verbose'].includes(val)) {
        consola.warn(`Invalid \`logLevel\` option: \`${val}\`. Must be one of: \`silent\`, \`info\`, \`verbose\`.`)
      }
      return val && typeof val === 'string' ? val as 'silent' | 'info' | 'verbose' : (isTest ? 'silent' : 'info')
    },
  },

  /**
   * Shared build configuration.
   */
  build: {
    /**
     * If you want to transpile specific dependencies with Babel, you can add them here.
     * Each item in transpile can be a package name, a function, a string or regex object matching the
     * dependency's file name.
     *
     * You can also use a function to conditionally transpile. The function will receive an object ({ isDev, isServer, isClient, isModern, isLegacy }).
     * @example
     * ```js
     * transpile: [({ isLegacy }) => isLegacy && 'ky']
     * ```
     * @type {Array<string | RegExp | ((ctx: { isClient?: boolean; isServer?: boolean; isDev: boolean }) => string | RegExp | false)>}
     */
    transpile: {
      $resolve: (val) => {
        const transpile: Array<string | RegExp | ((ctx: { isClient?: boolean, isServer?: boolean, isDev: boolean }) => string | RegExp | false)> = []
        if (Array.isArray(val)) {
          for (const pattern of val) {
            if (!pattern) {
              continue
            }
            if (typeof pattern === 'string' || typeof pattern === 'function' || pattern instanceof RegExp) {
              transpile.push(pattern)
            }
          }
        }
        return transpile
      },
    },

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
     * @type {typeof import('../src/types/nuxt').NuxtTemplate<any>[]}
     */
    templates: [],

    /**
     * Nuxt allows visualizing your bundles and how to optimize them.
     *
     * Set to `true` to enable bundle analysis, or pass an object with options: [for webpack](https://github.com/webpack-contrib/webpack-bundle-analyzer#options-for-plugin) or [for vite](https://github.com/btd/rollup-plugin-visualizer#options).
     * @example
     * ```js
     * analyze: {
     *   analyzerMode: 'static'
     * }
     * ```
     * @type {boolean | { enabled?: boolean } & ((0 extends 1 & typeof import('webpack-bundle-analyzer').BundleAnalyzerPlugin.Options ? Record<string, unknown> : typeof import('webpack-bundle-analyzer').BundleAnalyzerPlugin.Options) | typeof import('rollup-plugin-visualizer').PluginVisualizerOptions)}
     */
    analyze: {
      $resolve: async (val, get) => {
        const [rootDir, analyzeDir] = await Promise.all([get('rootDir'), get('analyzeDir')])
        return {
          template: 'treemap',
          projectRoot: rootDir,
          filename: join(analyzeDir, '{name}.html'),
          ...typeof val === 'boolean' ? { enabled: val } : typeof val === 'object' ? val : {},
        }
      },
    },
  },

  /**
   * Build time optimization configuration.
   */
  optimization: {
    /**
     * Functions to inject a key for.
     *
     * As long as the number of arguments passed to the function is less than `argumentLength`, an
     * additional magic string will be injected that can be used to deduplicate requests between server
     * and client. You will need to take steps to handle this additional key.
     *
     * The key will be unique based on the location of the function being invoked within the file.
     * @type {Array<{ name: string, source?: string | RegExp, argumentLength: number }>}
     */
    keyedComposables: {
      $resolve: val => [
        { name: 'callOnce', argumentLength: 3 },
        { name: 'defineNuxtComponent', argumentLength: 2 },
        { name: 'useState', argumentLength: 2 },
        { name: 'useFetch', argumentLength: 3 },
        { name: 'useAsyncData', argumentLength: 3 },
        { name: 'useLazyAsyncData', argumentLength: 3 },
        { name: 'useLazyFetch', argumentLength: 3 },
        ...Array.isArray(val) ? val : [],
      ].filter(Boolean),
    },

    /**
     * Tree shake code from specific builds.
     */
    treeShake: {
      /**
       * Tree shake composables from the server or client builds.
       * @example
       * ```js
       * treeShake: { client: { myPackage: ['useServerOnlyComposable'] } }
       * ```
       */
      composables: {
        server: {
          $resolve: async (val, get) => defu(typeof val === 'object' ? val as Record<string, string[]> || {} : {},
            await get('dev')
              ? {}
              : {
                  'vue': ['onMounted', 'onUpdated', 'onUnmounted', 'onBeforeMount', 'onBeforeUpdate', 'onBeforeUnmount', 'onRenderTracked', 'onRenderTriggered', 'onActivated', 'onDeactivated'],
                  '#app': ['definePayloadReviver', 'definePageMeta'],
                },
          ),
        },
        client: {
          $resolve: async (val, get) => defu(typeof val === 'object' ? val as Record<string, string[]> || {} : {},
            await get('dev')
              ? {}
              : {
                  'vue': ['onRenderTracked', 'onRenderTriggered', 'onServerPrefetch'],
                  '#app': ['definePayloadReducer', 'definePageMeta', 'onPrehydrate'],
                },
          ),
        },
      },
    },

    /**
     * Options passed directly to the transformer from `unctx` that preserves async context
     * after `await`.
     * @type {typeof import('unctx/transform').TransformerOptions}
     */
    asyncTransforms: {
      asyncFunctions: ['defineNuxtPlugin', 'defineNuxtRouteMiddleware'],
      objectDefinitions: {
        defineNuxtComponent: ['asyncData', 'setup'],
        defineNuxtPlugin: ['setup'],
        definePageMeta: ['middleware', 'validate'],
      },
    },
  },
})
