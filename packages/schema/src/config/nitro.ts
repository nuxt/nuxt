import type { Nuxt } from '../types/nuxt.ts'
import { type ResolverGetter, defineResolvers } from '../utils/definition.ts'

type ServerBuilder = '@nuxt/nitro-server' | '@nuxt/vite-server' | (string & {}) | { bundle: (nuxt: Nuxt) => Promise<void> }

const serverBuilders = {
  nitro: '@nuxt/nitro-server',
  vite: '@nuxt/vite-server',
} as const

export default defineResolvers({
  server: {
    builder: {
      $resolve: (val: unknown): ServerBuilder => {
        if (typeof val === 'string') {
          return serverBuilders[val as keyof typeof serverBuilders] ?? val
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
      $resolve: async (val: unknown, get: ResolverGetter) => {
        if (val === false) {
          return false
        }
        const topLevel = await get('tracingChannel')
        const base = typeof topLevel === 'object' ? topLevel : null
        const override = val && typeof val === 'object' ? val : null
        if (!base && !override) {
          return val === true ? {} : false
        }
        return { ...(base || {}), ...(override || {}) }
      },
    },
  },
  routeRules: {},
  serverHandlers: [],
  devServerHandlers: [],
  tracingChannel: {
    // Nuxt emits the `nuxt.*` diagnostics channels itself. The Nitro-level
    // channels (`srvx.request`, `h3.request`, `unstorage.*`) are only emitted
    // by Nitro v3, so they are not advertised here; explicitly-set keys are
    // still passed through for forward-compatibility.
    $resolve: (val: unknown) => {
      if (val === true) {
        return { nuxt: true }
      }
      if (val && typeof val === 'object') {
        return {
          nuxt: true,
          ...val,
        }
      }
      return false
    },
  },
})
