import { defineUntypedSchema } from 'untyped'
import { loading as loadingTemplate } from '@nuxt/ui-templates'

export default defineUntypedSchema({
  devServer: {
    /**
     * Whether to enable HTTPS.
     *
     * @example
     * ```
     * export default defineNuxtConfig({
     *   devServer: {
     *     https: {
     *       key: './server.key',
     *       cert: './server.crt'
     *     }
     *   }
     * })
     * ```
     * @type {boolean | { key: string; cert: string }}
     */
    https: false,

    /** Dev server listening port */
    port: process.env.NUXT_PORT || process.env.NITRO_PORT || process.env.PORT || 3000,

    /** Dev server listening host */
    host: process.env.NUXT_HOST || process.env.NITRO_HOST || process.env.HOST || '',

    /**
     * Listening dev server URL.
     *
     * This should not be set directly as it will always be overridden by the
     * dev server with the full URL (for module and internal use).
     */
    url: 'http://localhost:3000',

    /**
     * Template to show a loading screen
     *
     * @type {(data: { loading?: string }) => string}
     */
    loadingTemplate
  }
})
