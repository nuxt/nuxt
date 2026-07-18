import process from 'node:process'
import { defineResolvers } from '../utils/definition.ts'
import { template as loadingTemplate } from '../../../ui-templates/dist/templates/loading.ts'

export default defineResolvers({
  devServer: {
    https: false,
    port: Number(process.env.NUXT_PORT || process.env.NITRO_PORT || process.env.PORT || 3000),
    host: process.env.NUXT_HOST || process.env.NITRO_HOST || process.env.HOST || undefined,
    url: 'http://localhost:3000',
    loadingTemplate,
    cors: {
      origin: [/^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/],
    },
  },
})
