import type { Plugin } from 'vite'
import rollupReplacePlugin from '@rollup/plugin-replace'

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

      if (config.isProduction) {
        const { replacePlugin } = await import('rolldown/plugins')
        return replacePlugin(replaceOptions, { preventAssignment: true })
      } else {
        // TODO: can we use rolldown plugin for this?
        return rollupReplacePlugin({ ...replaceOptions, preventAssignment: true })
      }
    },
  }
}
