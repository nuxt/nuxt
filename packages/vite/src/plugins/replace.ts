import type { Plugin } from 'vite'
import { replacePlugin } from 'rolldown/plugins'

export function ReplacePlugin (): Plugin {
  return {
    name: 'nuxt:replace',
    enforce: 'post',
    applyToEnvironment (environment) {
      const config = environment.getTopLevelConfig()

      const replaceOptions: Record<string, string> = Object.create(null)

      for (const define of [config.define || {}, environment.config.define || {}]) {
        for (const key in define) {
          if (key.startsWith('import.meta.')) {
            replaceOptions[key] = define[key]
          }
        }
      }

      return replacePlugin(replaceOptions, { preventAssignment: true })
    },
  }
}
