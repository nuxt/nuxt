import type { Plugin } from 'vite'
import { tryImportModule } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { Nitro } from 'nitro/types'
import { resolveModulePath } from 'exsolve'

import { runtimeDependencies as runtimeNuxtDependencies } from '../../meta.mjs'

export function ResolveExternalsPlugin (nuxt: Nuxt): Plugin {
  let external: Set<string> = new Set()

  return {
    name: 'nuxt:resolve-externals',
    enforce: 'pre',
    async configResolved () {
      if (!nuxt.options.dev) {
        const { runtimeDependencies: runtimeNitroDependencies = [] } = await tryImportModule<typeof import('nitro/runtime/meta')>('nitro/runtime/meta', {
          url: new URL(import.meta.url),
        }) || {}

        external = new Set([
          // explicit dependencies we use in our ssr renderer - these can be inlined (if necessary) in the nitro build
          'unhead', '@unhead/vue', '@nuxt/devalue', 'rou3', 'unstorage',
          // ensure we only have one version of vue if nitro is going to inline anyway
          ...((nuxt as any)._nitro as Nitro).options.inlineDynamicImports ? ['vue', '@vue/server-renderer'] : [],
          ...runtimeNuxtDependencies,
          // dependencies we might share with nitro - these can be inlined (if necessary) in the nitro build
          ...runtimeNitroDependencies,
        ])
      }
    },
    async resolveId (id, importer) {
      if (!external.has(id)) {
        return
      }

      const res = await this.resolve?.(id, importer, { skipSelf: true })
      if (res !== undefined && res !== null) {
        if (res.id === id) {
          res.id = resolveModulePath(res.id, {
            try: true,
            from: importer,
            extensions: nuxt.options.extensions,
          }) || res.id
        }
        return {
          ...res,
          external: 'absolute',
        }
      }
    },
  }
}
