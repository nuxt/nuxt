import { defineResolvers } from '../utils/definition'
import { template as loadingTemplate } from '../../../ui-templates/dist/templates/loading'

export default defineResolvers({
  devServer: {
    https: false,
    port: Number(process.env.NUXT_PORT || process.env.NITRO_PORT || process.env.PORT || 3000),
    host: process.env.NUXT_HOST || process.env.NITRO_HOST || process.env.HOST || undefined,
    url: {
      $resolve: async (val, get) => {
        if (typeof val === 'string') {
          return val
        }
        const port = await get('devServer.port')
        const host = await get('devServer.host')
        const https = await get('devServer.https')
        const protocol = https ? 'https' : 'http'
        const hostname = host || 'localhost'
        return `${protocol}://${hostname}:${port}`
      },
    },
    loadingTemplate,
    cors: {
      origin: [/^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/],
    },
  },
})
