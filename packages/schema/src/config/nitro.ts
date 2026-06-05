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
  },
  routeRules: {},
  serverHandlers: [],
  devServerHandlers: [],
  /**
   * Order of server middleware execution. When `configuredFirst` (default), handlers added via
   * `serverHandlers` / `addServerHandler` run before auto-scanned handlers from `server/middleware/`.
   * Use `scannedFirst` to restore the previous behavior (scanned handlers run first).
   */
  serverMiddlewareOrder: 'configuredFirst',
})
