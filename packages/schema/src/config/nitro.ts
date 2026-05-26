import type { Nuxt } from '../types/nuxt.ts'
import { type ResolverGetter, defineResolvers } from '../utils/definition.ts'

type ServerBuilder = '@nuxt/nitro-server' | (string & {}) | { bundle: (nuxt: Nuxt) => Promise<void> }

export default defineResolvers({
  server: {
    builder: {
      $resolve: (val: unknown): ServerBuilder => {
        if (typeof val === 'string') {
          return val
        }
        if (val && typeof val === 'object' && 'bundle' in val) {
          return val as { bundle: (nuxt: Nuxt) => Promise<void> }
        }
        return '@nuxt/nitro-server'
      },
    },
  },
  nitro: {
    runtimeConfig: {
      $resolve: async (val: unknown, get: ResolverGetter) => {
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
      $resolve: async (val: unknown, get: ResolverGetter) => {
        return {
          ...await get('routeRules'),
          ...(val && typeof val === 'object' ? val : {}),
        }
      },
    },
    tracingChannel: {
      $resolve: async (val, get) => {
        const topLevel = await get('tracingChannel')
        if (!topLevel && !val) {
          return undefined
        }
        return {
          ...(typeof topLevel === 'object' ? topLevel : {}),
          ...(val && typeof val === 'object' ? val : {}),
        }
      },
    },
  },
  routeRules: {},
  serverHandlers: [],
  devServerHandlers: [],
  tracingChannel: {
    $resolve: (val) => {
      if (val === true) {
        return { nuxt: true, srvx: true, h3: true, unstorage: true }
      }
      if (val && typeof val === 'object') {
        return {
          nuxt: true,
          srvx: true,
          h3: true,
          unstorage: true,
          ...val,
        }
      }
      return false
    },
  },
})
