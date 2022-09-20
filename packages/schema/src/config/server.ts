import { SchemaDefinition } from 'untyped'

/** @version 2 */
export default <SchemaDefinition>{
  /**
   * Whether to enable HTTPS.
   *
   * @example
   * ```
   * import { fileURLToPath } from 'node:url'
   * export default {
   *   server: {
   *     https: {
   *       key: fs.readFileSync(fileURLToPath(new URL('./server.key', import.meta.url))),
   *       cert: fs.readFileSync(fileURLToPath(new URL('./server.crt', import.meta.url)))
   *     }
   *   }
   * }
   * ```
   *
   * @version 2
   *
   * @type {false | { key: string; cert: string }}
   *
   * @deprecated  This option is ignored with Bridge and Nuxt 3
   */
  https: false,
  /** @deprecated  This option is ignored with Bridge and Nuxt 3 */
  port: process.env.NUXT_PORT || process.env.PORT || process.env.npm_package_config_nuxt_port || 3000,
  /** @deprecated  This option is ignored with Bridge and Nuxt 3 */
  host: process.env.NUXT_HOST || process.env.HOST || process.env.npm_package_config_nuxt_host || 'localhost',
  /** @deprecated  This option is ignored with Bridge and Nuxt 3 */
  socket: process.env.UNIX_SOCKET || process.env.npm_package_config_unix_socket,

  /**
   * Enabling timing adds a middleware to measure the time elapsed during
   * server-side rendering and adds it to the headers as 'Server-Timing'.
   *
   * Apart from true/false, this can be an object for providing options.
   * Currently, only `total` is supported (which directly tracks the whole
   * time spent on server-side rendering.
   */
  /** @deprecated This option is ignored with Bridge and Nuxt 3 */
  timing: (val: any) => val ? ({ total: true, ...val }) : false,

  /**
   * Listening dev server url
   */
  url: 'http://localhost:3000',
}
