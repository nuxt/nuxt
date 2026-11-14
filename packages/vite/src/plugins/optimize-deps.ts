import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { hasOwnSubpathImport } from '@nuxt/kit/internal'

import { appScanEntries, resolveOptimizeDepsInclude } from '../utils/optimize-deps.ts'
import { userOptimizeDepsInclude } from './optimize-deps-hint.ts'

/**
 * Adds the files Nuxt reaches through generated modules to the client dependency scan, and
 * rewrites `optimizeDeps.include` entries that only resolve from an installed layer.
 *
 * Runs on resolved environment config so `include` entries added by modules through
 * `vite:extendConfig`, or by other plugins, are rewritten too.
 *
 * During the dependency scan, `#components` and any `#` imports or packages that fail to resolve are excluded.
 */
export function OptimizeDepsPlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:optimize-deps',
    enforce: 'post',
    apply: 'serve',
    applyToEnvironment: environment => environment.name === 'client',

    resolveId: {
      order: 'pre',
      filter: {
        id: /^(?:#|[\w@][^:])/,
      },
      async handler (id, importer, options) {
        // `scan` is not part of Vite's public hook type
        if (!('scan' in options) || !options.scan) { return }
        if (id[0] !== '#') {
          // Vite drops the whole scan when a package is missing
          try {
            return await this.resolve(id, importer, { ...options, skipSelf: true }) ?? { id, external: true }
          } catch {
            return { id, external: true }
          }
        }
        if (id === '#components' && !(importer && await hasOwnSubpathImport(importer, id, nuxt.options.rootDir))) {
          return { id, external: true }
        }
        try {
          return await this.resolve(id, importer, { ...options, skipSelf: true })
        } catch {
          return { id, external: true }
        }
      },
    },

    async configEnvironment (name, config) {
      if (name !== 'client') { return }

      config.optimizeDeps ||= {}

      const entries = config.optimizeDeps.entries
      config.optimizeDeps.entries = [...typeof entries === 'string' ? [entries] : entries || [], ...await appScanEntries(nuxt)]

      const include = config.optimizeDeps.include
      if (include?.length) {
        const resolved = await resolveOptimizeDepsInclude(nuxt, include)

        // rewritten entries must stay attributable to the user in `NUXT_B7002`
        const userInclude = userOptimizeDepsInclude.get(nuxt)
        if (userInclude) {
          for (const [index, entry] of include.entries()) {
            if (resolved[index] !== entry && userInclude.includes(entry)) {
              userInclude.push(resolved[index]!)
            }
          }
        }

        config.optimizeDeps.include = resolved
      }
    },
  }
}
