import { defineResolvers } from '../utils/definition'
import { template as loadingTemplate } from '../../../ui-templates/dist/templates/loading'

export default defineResolvers({
  devServer: {
    /**
     * Whether to enable HTTPS.
     * @example
     * ```ts
     * export default defineNuxtConfig({
     *   devServer: {
     *     https: {
     *       key: './server.key',
     *       cert: './server.crt'
     *     }
     *   }
     * })
     * ```
     */
    https: false,

    /** Dev server listening port */
    port: Number(process.env.NUXT_PORT || process.env.NITRO_PORT || process.env.PORT || 3000),

    /**
     * Dev server listening host
     */
    host: process.env.NUXT_HOST || process.env.NITRO_HOST || process.env.HOST || undefined,

    /**
     * Listening dev server URL.
     *
     * This should not be set directly as it will always be overridden by the
     * dev server with the full URL (for module and internal use).
     */
    url: 'http://localhost:3000',

    /**
     * Template to show a loading screen
     */
    loadingTemplate,

    /**
     * Set CORS options for the dev server
     */
    cors: {
      origin: [/^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/],
    },
  },
})
