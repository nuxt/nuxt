import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'

export function ClientChunksPlugin (nuxt: Nuxt): Plugin {
  let isSingleEntry = false
  const layoutDeps = new Set<string>()

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
            { name: 'layout', test: id => layoutDeps.has(id) },
          ],
        },
      }
    },
    async buildEnd () {
      isSingleEntry = false
      layoutDeps.clear()

      let entries = 0
      for (const id of this.getModuleIds()) {
        if (this.getModuleInfo(id)?.isEntry && ++entries > 1) { return }
      }
      isSingleEntry = entries === 1

      const layouts = Object.values(nuxt.apps.default?.layouts ?? {})
      if (!isSingleEntry || !nuxt.options.experimental.layoutChunk || layouts.length !== 1) { return }
      const layoutId = (await this.resolve(layouts[0]!.file))?.id
      if (!layoutId) { return }

      const queue = [layoutId]
      const seen = new Set<string>()
      while (queue.length) {
        const id = queue.pop()!
        if (seen.has(id)) { continue }
        seen.add(id)
        for (const imported of this.getModuleInfo(id)?.importedIds ?? []) {
          if (imported.startsWith(layoutId + '?')) {
            queue.push(imported)
          } else {
            layoutDeps.add(imported)
          }
        }
      }
    },
  }
}
