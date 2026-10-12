import { normalize, resolve } from 'pathe'
import type { Nuxt } from '@nuxt/schema'
import type { Plugin } from 'vite'
import { useServerBuild } from '@nuxt/kit/internal'

const ISLANDS_ID = '#build/dist/server/components.islands.mjs'
const RESOLVED_ISLANDS_ID = '\0nuxt-onigiri-islands'

/**
 * Serve the islands map the vue-onigiri island handler imports when the app is bundled in Nitro's Vite `ssr` environment, which has no separate `dist/server` output to read it from.
 */
export function OnigiriIslandsPlugin (nuxt: Nuxt): Plugin | undefined {
  if (nuxt.options.experimental.componentIslands !== 'vue-onigiri' || useServerBuild(nuxt).buildsSeparately) {
    return
  }

  const islandsOutput = resolve(nuxt.options.buildDir, 'dist/server/components.islands.mjs')

  return {
    name: 'nuxt:onigiri-islands',
    applyToEnvironment: env => env.name === 'ssr',
    resolveId: {
      order: 'pre',
      handler (id) {
        if (id === ISLANDS_ID || normalize(id) === islandsOutput) {
          return RESOLVED_ISLANDS_ID
        }
      },
    },
    load (id) {
      if (id === RESOLVED_ISLANDS_ID) {
        return 'export * from \'#build/components.islands.mjs\''
      }
    },
  }
}
