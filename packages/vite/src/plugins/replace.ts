import type { Plugin } from 'vite'
import type { RollupReplaceOptions } from '@rollup/plugin-replace'
import replace from '@rollup/plugin-replace'

export function ReplacePlugin (): Plugin {
  return {
    name: 'nuxt:replace',
    enforce: 'post',
    applyToEnvironment (environment) {
      const config = environment.getTopLevelConfig()

      const replaceOptions: RollupReplaceOptions = Object.create(null)
      replaceOptions.preventAssignment = true

      for (const define of [config.define || {}, environment.config.define || {}]) {
        for (const key in define) {
          if (key.startsWith('import.meta.')) {
            replaceOptions[key] = define[key]
          }
        }
      }

      return replace(replaceOptions)
    },
  }
}
