import process from 'node:process'
import { defineResolvers } from '../utils/definition.ts'
import { template as loadingTemplate } from '../templates/loading.ts'

export default defineResolvers({
  devServer: {
    https: false,
    port: Number(process.env.NUXT_PORT || process.env.NITRO_PORT || process.env.PORT || 3000),
    host: {
      $schema: { type: 'string' },
      $resolve: val => typeof val === 'string' && val ? val : process.env.NUXT_HOST || process.env.NITRO_HOST || process.env.HOST || undefined,
    },
    allowedHosts: {
      $resolve: async (val, get) => {
        const [host, viteAllowedHosts] = await Promise.all([get('devServer.host'), get('vite.server').then(r => r?.allowedHosts)])
        if (val === true || viteAllowedHosts === true) {
          return true
        }
        const hosts = [
          ...Array.isArray(val) ? val : [],
          ...Array.isArray(viteAllowedHosts) ? viteAllowedHosts : [],
          host,
        ]
        return [...new Set(hosts.filter((h): h is string => typeof h === 'string' && !!h))]
      },
    },
    url: 'http://localhost:3000',
    loadingTemplate,
    errorChannel: '/__nuxt_dev__/error',
    cors: {
      origin: [/^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/],
    },
  },
})
