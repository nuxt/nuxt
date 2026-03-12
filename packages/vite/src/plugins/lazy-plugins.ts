import { useNitro } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { relative } from 'pathe'
import { withoutLeadingSlash } from 'ufo'
import type { Plugin } from 'vite'

export function LazyPluginPreloadPlugin (nuxt: Nuxt): Plugin | undefined {
  if (nuxt.options.dev) { return }

  const nitro = useNitro()
  const lazyPluginFiles: string[] = []

  return {
    name: 'nuxt:lazy-plugin-preload',
    apply: 'build',
    applyToEnvironment (environment) {
      return environment.name === 'client'
    },
    buildEnd () {
      const clientPlugins = nuxt.apps.default?.plugins?.filter(p => p.lazy && (!p.mode || p.mode !== 'server')) || []
      for (const plugin of clientPlugins) {
        lazyPluginFiles.push(relative(nuxt.options.rootDir, plugin.src))
      }
    },
    generateBundle (_options, bundle) {
      const prefix = withoutLeadingSlash(nuxt.options.app.buildAssetsDir)
      const lazyChunkFiles: string[] = []
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.isDynamicEntry || !chunk.facadeModuleId) { continue }
        const relativeId = relative(nuxt.options.rootDir, chunk.facadeModuleId)
        if (lazyPluginFiles.includes(relativeId)) {
          let file = chunk.fileName
          if (file.startsWith(prefix)) {
            file = file.slice(prefix.length)
          }
          lazyChunkFiles.push(file)
        }
      }

      nitro.options.virtual ||= {}
      nitro.options._config.virtual ||= {}
      nitro.options._config.virtual['#internal/nuxt/lazy-plugin-entries.mjs'] = nitro.options.virtual['#internal/nuxt/lazy-plugin-entries.mjs'] = () => `export default ${JSON.stringify(lazyChunkFiles)}`
    },
  }
}
