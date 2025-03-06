import type { Plugin } from 'vite'
import { tryImportModule } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { Nitro } from 'nitropack'
import type { PackageJson } from 'pkg-types'

export function ResolveExternalsPlugin (nuxt: Nuxt): Plugin {
  let external: Set<string> = new Set()

  return {
    name: 'nuxt:resolve-externals',
    enforce: 'pre',
    async configResolved () {
      if (!nuxt.options.dev) {
        const runtimeDependencies = await tryImportModule<PackageJson>('nitropack/package.json', {
          url: new URL(import.meta.url),
        })?.then(r => r?.dependencies ? Object.keys(r.dependencies) : []).catch(() => []) || []

        external = new Set([
          // explicit dependencies we use in our ssr renderer - these can be inlined (if necessary) in the nitro build
          'unhead', '@unhead/vue', 'unctx', 'h3', 'devalue', '@nuxt/devalue', 'radix3', 'rou3', 'unstorage', 'hookable',
          // ensure we only have one version of vue if nitro is going to inline anyway
          ...((nuxt as any)._nitro as Nitro).options.inlineDynamicImports ? ['vue', '@vue/server-renderer', '@unhead/vue'] : [],
          // dependencies we might share with nitro - these can be inlined (if necessary) in the nitro build
          ...runtimeDependencies,
        ])
      }
    },
    async resolveId (id, importer) {
      if (!external.has(id)) {
        return
      }

      const res = await this.resolve?.(id, importer, { skipSelf: true })
      if (res !== undefined && res !== null) {
        return {
          ...res,
          external: 'absolute',
        }
      }
    },
  }
}
