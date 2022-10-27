import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  devServer: {
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
     *
     * @type {false | { key: string; cert: string }}
     *
     */
    https: false,

    /** Dev server listening port */
    port: process.env.NUXT_PORT || process.env.NITRO_PORT || process.env.PORT || 3000,

    /** Dev server listening host */
    host: process.env.NUXT_HOST || process.env.NITRO_HOST || process.env.HOST || 'localhost',

    /**
     * Listening dev server url
     */
    url: 'http://localhost:3000',
  }
})
