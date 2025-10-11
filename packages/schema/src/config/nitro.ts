import { defineResolvers } from '../utils/definition'

export default defineResolvers({
  server: {
    builder: {
      $resolve: (val) => {
        if (typeof val === 'string') { return val }
        return '@nuxt/nitro-server'
      },
    },
  },
  nitro: {
    runtimeConfig: {
      $resolve: async (val, get) => {
        const runtimeConfig = await get('runtimeConfig')
        return {
          ...runtimeConfig,
          app: {
            ...runtimeConfig.app,
            baseURL: runtimeConfig.app.baseURL.startsWith('./')
              ? runtimeConfig.app.baseURL.slice(1)
              : runtimeConfig.app.baseURL,
          },
          nitro: {
            envPrefix: 'NUXT_',
            ...runtimeConfig.nitro,
          },
        }
      },
    },
    routeRules: {
      $resolve: async (val, get) => {
        return {
          ...await get('routeRules'),
          ...(val && typeof val === 'object' ? val : {}),
        }
      },
    },
  },
  routeRules: {},
  serverHandlers: [],
  devServerHandlers: [],
})
