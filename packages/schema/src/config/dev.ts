import process from 'node:process'
import { defineResolvers } from '../utils/definition.ts'
import { template as loadingTemplate } from '../../../ui-templates/dist/templates/loading.ts'

export default defineResolvers({
  devServer: {
    https: false,
    port: {
      $resolve: (val) => {
        if (typeof val === 'number' || typeof val === 'string') {
          return Number(val)
        }
        return Number(process.env.NUXT_PORT || process.env.NITRO_PORT || process.env.PORT || 3000)
      },
    },
    host: {
      $resolve: (val) => {
        if (typeof val === 'string') {
          return val
        }
        return process.env.NUXT_HOST || process.env.NITRO_HOST || process.env.HOST || undefined
      },
    },
    url: 'http://localhost:3000',
    loadingTemplate,
    cors: {
      origin: [/^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/],
    },
  },
})
