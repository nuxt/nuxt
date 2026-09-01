import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'

import { toArray } from '../utils/index.ts'
import { createOptimizeDepsIncludeResolver, installedScanEntries } from '../utils/optimize-deps.ts'
import { userOptimizeDepsInclude } from './optimize-deps-hint.ts'

/**
 * Pre-bundles dependencies of app code installed in `node_modules`, which Vite would
 * otherwise serve raw.
 *
 * Runs on resolved environment config so `include` entries added by modules through
 * `vite:extendConfig`, or by other plugins, are rewritten too.
 */
export function OptimizeDepsPlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:optimize-deps',
    enforce: 'post',

    configEnvironment (name, config) {
      if (name !== 'client') { return }

      const scanEntries = installedScanEntries(nuxt)
      if (scanEntries.length) {
        const optimizeDeps = config.optimizeDeps ||= {}
        optimizeDeps.entries = [...optimizeDeps.entries ? toArray(optimizeDeps.entries) : [], ...scanEntries]
      }

      const include = config.optimizeDeps?.include
      if (!include?.length) { return }

      const resolveInclude = createOptimizeDepsIncludeResolver(nuxt, {
        // vite merges the top-level `resolve` into every environment but does not type it there
        preserveSymlinks: (config.resolve as { preserveSymlinks?: boolean } | undefined)?.preserveSymlinks,
      })

      // rewritten entries must stay attributable to the user in `NUXT_B7002`
      const userInclude = userOptimizeDepsInclude.get(nuxt)
      userInclude?.push(...resolveInclude(userInclude).filter(entry => !userInclude.includes(entry)))

      config.optimizeDeps!.include = resolveInclude(include)
    },
  }
}
