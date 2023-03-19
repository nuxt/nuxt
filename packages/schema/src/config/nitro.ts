import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  /**
   * Configuration for Nitro.
   *
   * @see https://nitro.unjs.io/config/
   *
   * @type {typeof import('nitropack')['NitroConfig']}
   */
  nitro: {
    routeRules: {
      $resolve: async (val, get) => ({
        ...await get('routeRules') || {},
        ...val || {}
      })
    }
  },

  /**
   * Global route options applied to matching server routes.
   *
   * @experimental This is an experimental feature and API may change in the future.
   *
   * @see https://nitro.unjs.io/config/#routerules
   *
   * @type {typeof import('nitropack')['NitroConfig']['routeRules']}
   */
  routeRules: {},

  /**
   * Nitro server handlers.
   *
   * Each handler accepts the following options:
   * - handler: The path to the file defining the handler.
   * - route: The route under which the handler is available. This follows the conventions of https://github.com/unjs/radix3.
   * - method: The HTTP method of requests that should be handled.
   * - middleware: Specifies whether it is a middleware handler.
   * - lazy: Specifies whether to use lazy loading to import the handler.
   *
   * @see https://nuxt.com/docs/guide/directory-structure/server
   *
   * @note Files from `server/api`, `server/middleware` and `server/routes` will be automatically registered by Nuxt.
   *
   * @example
   * ```js
   * serverHandlers: [
   *   { route: '/path/foo/**:name', handler: '~/server/foohandler.ts' }
   * ]
   * ```
   *
   * @type {typeof import('nitropack')['NitroEventHandler'][]}
   */
  serverHandlers: [],

  /**
   * Nitro development-only server handlers.
   *
   * @see https://nitro.unjs.io/guide/routing
   *
   * @type {typeof import('nitropack')['NitroDevEventHandler'][]}
   */
  devServerHandlers: []
})
