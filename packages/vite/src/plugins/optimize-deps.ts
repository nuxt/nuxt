import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { hasOwnSubpathImport } from '@nuxt/kit/internal'

import { installedScanEntries, resolveOptimizeDepsInclude } from '../utils/optimize-deps.ts'
import { userOptimizeDepsInclude } from './optimize-deps-hint.ts'

/**
 * Pre-bundles dependencies of app code installed in `node_modules`, which Vite would
 * otherwise serve raw.
 *
 * Runs on resolved environment config so `include` entries added by modules through
 * `vite:extendConfig`, or by other plugins, are rewritten too.
 *
 * During the dependency scan, `#components` and any `#` imports that fail to resolve are excluded.
 */
export function OptimizeDepsPlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:optimize-deps',
    enforce: 'post',

    resolveId: {
      order: 'pre',
      filter: {
        id: /^#/,
      },
      async handler (id, importer, options) {
        // `scan` is not part of Vite's public hook type
        if (!('scan' in options) || !options.scan) { return }
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

      const scanEntries = installedScanEntries(nuxt)
      if (!scanEntries.length) { return }

      config.optimizeDeps ||= {}

      const entries = config.optimizeDeps.entries
      config.optimizeDeps.entries = [...typeof entries === 'string' ? [entries] : entries || [], ...scanEntries]

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
