export default {
  /**
   * Configuration for Nitro
   *
   * @see https://nitro.unjs.io/config/
   *
   * @type {typeof import('nitropack')['NitroConfig']}
   * @version 2
   * @version 3
  */
  nitro: {},

  /**
   * Nitro server handlers
   *
   * @see https://nitro.unjs.io/guide/routing.html
   *
   * **Note:** Files from `server/api`, `server/middleware` and `server/routes` will be automatically registred by Nuxt.
   *
   * @type {typeof import('nitropack')['NitroEventHandler'][]}
   * @version 3
   */
  serverHandlers: [],

  /**
   * Nitro devevelopment-only server handlers
   *
   * @see https://nitro.unjs.io/guide/routing.html
   *
   * @type {typeof import('nitropack')['NitroDevEventHandler'][]}
   * @version 3
   */
   devServerHandlers: []
}
