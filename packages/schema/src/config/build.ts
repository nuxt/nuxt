import { defineUntypedSchema } from 'untyped'
import { defu } from 'defu'
import { join } from 'pathe'
import { isTest } from 'std-env'

export default defineUntypedSchema({
  /**
   * The builder to use for bundling the Vue part of your application.
   *
   * @type {'vite' | 'webpack' | { bundle: (nuxt: typeof import('../src/types/nuxt').Nuxt) => Promise<void> }}
   */
  builder: {
    $resolve: async (val, get) => {
      if (typeof val === 'object') {
        return val
      }
      const map: Record<string, string> = {
        vite: '@nuxt/vite-builder',
        webpack: '@nuxt/webpack-builder',
      }
      return map[val] || val || (await get('vite') === false ? map.webpack : map.vite)
    }
  },

  /**
   * Whether to generate sourcemaps.
   *
   * @type {boolean | { server?: boolean, client?: boolean }}
   */
  sourcemap: {
    $resolve: async (val, get) => {
      if (typeof val === 'boolean') {
        return { server: val, client: val }
      }
      return defu(val, {
        server: true,
        client: await get('dev')
      })
    },
  },

  /**
   * Log level when building logs.
   *
   * Defaults to 'silent' when running in CI or when a TTY is not available.
   * This option is then used as 'silent' in Vite and 'none' in Webpack
   *
   * @type {'silent' | 'info' | 'verbose'}
   */
  logLevel: {
    $resolve: (val) => {
      if (val && !['silent', 'info', 'verbose'].includes(val)) {
        console.warn(`Invalid \`logLevel\` option: \`${val}\`. Must be one of: \`silent\`, \`info\`, \`verbose\`.`)
      }
      return val ?? (isTest ? 'silent' : 'info')
    }
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
     *
     * @example
     * ```js
     transpile: [({ isLegacy }) => isLegacy && 'ky']
     * ```
     * @type {Array<string | RegExp | ((ctx: { isClient?: boolean; isServer?: boolean; isDev: boolean }) => string | RegExp | false)>}
     */
    transpile: {
      $resolve: val => [].concat(val).filter(Boolean)
    },

    /**
     * You can provide your own templates which will be rendered based
     * on Nuxt configuration. This feature is specially useful for using with modules.
     *
     * Templates are rendered using [`lodash.template`](https://lodash.com/docs/4.17.15#template).
     *
     * @example
     * ```js
     * templates: [
     *   {
     *     src: '~/modules/support/plugin.js', // `src` can be absolute or relative
     *     dst: 'support.js', // `dst` is relative to project `.nuxt` dir
     *     options: {
     *       // Options are provided to template as `options` key
     *       live_chat: false
     *     }
     *   }
     * ]
     * ```
     */
    templates: [],

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
     * @type {boolean | typeof import('webpack-bundle-analyzer').BundleAnalyzerPlugin.Options | typeof import('rollup-plugin-visualizer').PluginVisualizerOptions}
     *
     */
    analyze: {
      $resolve: async (val, get) => {
        if (val !== true) {
          return val ?? false
        }
        const rootDir = await get('rootDir')
        return {
          template: 'treemap',
          projectRoot: rootDir,
          filename: join(rootDir, '.nuxt/stats', '{name}.html')
        }
      }
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
     *
     * @type {Array<{ name: string, argumentLength: number }>}
     */
    keyedComposables: {
      $resolve: (val) => [
        { name: 'useState', argumentLength: 2 },
        { name: 'useFetch', argumentLength: 3 },
        { name: 'useAsyncData', argumentLength: 3 },
        { name: 'useLazyAsyncData', argumentLength: 3 },
        { name: 'useLazyFetch', argumentLength: 3 },
      ].concat(val).filter(Boolean)
    },

    /**
     * Tree shake code from specific builds.
     */
    treeShake: {
      /**
       * Tree shake composables from the server or client builds.
       *
       * @example
       * ```js
       * treeShake: { client: { myPackage: ['useServerOnlyComposable'] } }
       * ```
       */
      composables: {
        server: {
          $resolve: async (val, get) => defu(val || {},
            await get('dev') ? {} : {
              vue: ['onBeforeMount', 'onMounted', 'onBeforeUpdate', 'onRenderTracked', 'onRenderTriggered', 'onActivated', 'onDeactivated', 'onBeforeUnmount'],
              '#app': ['definePayloadReviver']
            }
          )
        },
        client: {
          $resolve: async (val, get) => defu(val || {},
            await get('dev') ? {} : {
              vue: ['onServerPrefetch', 'onRenderTracked', 'onRenderTriggered'],
              '#app': ['definePayloadReducer']
            }
          )
        }
      }
    },

    /**
     * Options passed directly to the transformer from `unctx` that preserves async context
     * after `await`.
     *
     * @type {import('unctx').TransformerOptions}
     */
    asyncTransforms: {
      asyncFunctions: ['defineNuxtPlugin', 'defineNuxtRouteMiddleware'],
      objectDefinitions: {
        defineNuxtComponent: ['asyncData', 'setup'],
        defineNuxtPlugin: ['setup'],
        definePageMeta: ['middleware', 'validate']
      }
    }
  }
})
