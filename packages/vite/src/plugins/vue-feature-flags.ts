import type { Nitro } from 'nitropack/types'
import type { Nuxt } from '@nuxt/schema'
import type { Plugin } from 'vite'

export function VueFeatureFlagsPlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:nitro:vue-feature-flags',
    applyToEnvironment: environment => environment.name === 'ssr' && environment.config.isProduction,
    configResolved (config) {
      for (const key in config.define) {
        if (key.startsWith('__VUE')) {
          // tree-shake vue feature flags for non-node targets
          ((nuxt as any)._nitro as Nitro).options.replace[key] = config.define[key]
        }
      }
    },
  }
}
