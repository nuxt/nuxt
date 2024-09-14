import { defineUntypedSchema } from 'untyped'
import type { RuntimeConfig } from '../types/config'

export default defineUntypedSchema({
  /**
   * Configuration for Nitro.
   * @see [Nitro configuration docs](https://nitro.unjs.io/config/)
   * @type {typeof import('nitro/types')['NitroConfig']}
   */
  nitro: {
    runtimeConfig: {
      $resolve: async (val: Record<string, any> | undefined, get) => {
        const runtimeConfig = await get('runtimeConfig') as RuntimeConfig
        return {
          ...runtimeConfig,
          app: {
            ...runtimeConfig.app,
            baseURL: runtimeConfig.app.baseURL.startsWith('./')
              ? runtimeConfig.app.baseURL.slice(1)
              : runtimeConfig.app.baseURL,
          },
          nitro: {
            envPrefix: 'NUXT_',
            ...runtimeConfig.nitro,
          },
        }
      },
    },
    routeRules: {
      $resolve: async (val: Record<string, any> | undefined, get) => ({
        ...await get('routeRules') as Record<string, any>,
        ...val,
      }),
    },
  },

  /**
   * Global route options applied to matching server routes.
   * @experimental This is an experimental feature and API may change in the future.
   * @see [Nitro route rules documentation](https://nitro.unjs.io/config/#routerules)
   * @type {typeof import('nitro/types')['NitroConfig']['routeRules']}
   */
  routeRules: {},

  /**
   * Nitro server handlers.
   *
   * Each handler accepts the following options:
   *
   * - handler: The path to the file defining the handler.
   * - route: The route under which the handler is available. This follows the conventions of [rou3](https://github.com/unjs/rou3.)
   * - method: The HTTP method of requests that should be handled.
   * - middleware: Specifies whether it is a middleware handler.
   * - lazy: Specifies whether to use lazy loading to import the handler.
   *
   * @see [`server/` directory documentation](https://nuxt.com/docs/guide/directory-structure/server)
   * @note Files from `server/api`, `server/middleware` and `server/routes` will be automatically registered by Nuxt.
   * @example
   * ```js
   * serverHandlers: [
   *   { route: '/path/foo/**:name', handler: '~/server/foohandler.ts' }
   * ]
   * ```
   * @type {typeof import('nitro/types')['NitroEventHandler'][]}
   */
  serverHandlers: [],

  /**
   * Nitro development-only server handlers.
   * @see [Nitro server routes documentation](https://nitro.unjs.io/guide/routing)
   * @type {typeof import('nitro/types')['NitroDevEventHandler'][]}
   */
  devServerHandlers: [],
})
