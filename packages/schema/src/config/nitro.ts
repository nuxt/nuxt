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
  },
  routeRules: {},
  serverHandlers: [],
  devServerHandlers: [],
})
