import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'

export function ClientChunksPlugin (nuxt: Nuxt): Plugin {
  let isSingleEntry = false

  return {
    name: 'nuxt:client-chunks',
    apply: () => !nuxt.options.dev,
    applyToEnvironment: environment => environment.name === 'client',
    outputOptions (options) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      if (options.codeSplitting != null || options.manualChunks || options.advancedChunks || options.inlineDynamicImports) {
        return
      }
      return {
        ...options,
        codeSplitting: {
          groups: [
            { name: 'entry', tags: ['$initial'], test: () => isSingleEntry },
          ],
        },
      }
    },
    buildEnd () {
      isSingleEntry = false

      let entries = 0
      for (const id of this.getModuleIds()) {
        if (this.getModuleInfo(id)?.isEntry && ++entries > 1) { return }
      }
      isSingleEntry = entries === 1
    },
  }
}
