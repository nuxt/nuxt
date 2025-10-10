import type { Plugin } from 'vite'
import replacePlugin from '@rollup/plugin-replace'
import * as vite from 'vite'

export function ReplacePlugin (): Plugin {
  return {
    name: 'nuxt:replace',
    enforce: 'post',
    async applyToEnvironment (environment) {
      const config = environment.getTopLevelConfig()

      const replaceOptions: Record<string, string> = Object.create(null)

      for (const define of [config.define || {}, environment.config.define || {}]) {
        for (const key in define) {
          if (key.startsWith('import.meta.')) {
            replaceOptions[key] = define[key]
          }
        }
      }

      // @ts-expect-error Rolldown-specific check
      if (vite.rolldownVersion) {
        const { replacePlugin } = await import('rolldown/experimental')
        return replacePlugin(replaceOptions, { preventAssignment: true })
      } else {
        return replacePlugin({ ...replaceOptions, preventAssignment: true })
      }
    },
  }
}
