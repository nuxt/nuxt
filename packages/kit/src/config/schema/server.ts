/** @version 2 */
export default {
  /**
   * Whether to enable HTTPS.
   *
   * @example
   * ```js
   * export default {
   *   server: {
   *     https: {
   *       key: fs.readFileSync(path.resolve(__dirname, 'server.key')),
   *       cert: fs.readFileSync(path.resolve(__dirname, 'server.crt'))
   *     }
   *   }
   * }
   * ```
   */
  https: false,
  port: process.env.NUXT_PORT || process.env.PORT || process.env.npm_package_config_nuxt_port || 3000,
  host: process.env.NUXT_HOST || process.env.HOST || process.env.npm_package_config_nuxt_host || 'localhost',
  socket: process.env.UNIX_SOCKET || process.env.npm_package_config_unix_socket,

  /**
   * Enabling timing adds a middleware to measure the time elapsed during
   * server-side rendering and adds it to the headers as 'Server-Timing'.
   *
   * Apart from true/false, this can be an object for providing options.
   * Currently, only `total` is supported (which directly tracks the whole
   * time spent on server-side rendering.
   */
  timing: (val: any) => val ? ({ total: true, ...val }) : false
}
