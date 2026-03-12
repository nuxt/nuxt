import { readFileSync } from 'node:fs'
import { useNitro } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { normalize } from 'pathe'
import { withoutLeadingSlash } from 'ufo'
import type { Plugin } from 'vite'

const LAZY_PLUGIN_RE = /defineLazyNuxtPlugin/

export function LazyPluginPreloadPlugin (nuxt: Nuxt): Plugin | undefined {
  if (nuxt.options.dev) { return }

  const nitro = useNitro()
  const lazyPluginSrcs = new Set<string>()

  return {
    name: 'nuxt:lazy-plugin-preload',
    apply: 'build',
    applyToEnvironment (environment) {
      return environment.name === 'client'
    },
    buildEnd () {
      const clientPlugins = nuxt.apps.default?.plugins?.filter(p => !p.mode || p.mode !== 'server') || []
      for (const plugin of clientPlugins) {
        // Check explicit lazy flag (from nuxt.config or addPlugin)
        if (plugin.lazy) {
          lazyPluginSrcs.add(normalize(plugin.src))
          continue
        }
        // Detect defineLazyNuxtPlugin in source
        try {
          const code = nuxt.vfs[plugin.src] ?? readFileSync(plugin.src, 'utf-8')
          if (LAZY_PLUGIN_RE.test(code)) {
            lazyPluginSrcs.add(normalize(plugin.src))
          }
        } catch {}
      }
    },
    generateBundle (_options, bundle) {
      const prefix = withoutLeadingSlash(nuxt.options.app.buildAssetsDir)
      const lazyChunkFiles: string[] = []
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.isDynamicEntry || !chunk.facadeModuleId) { continue }
        const moduleId = normalize(chunk.facadeModuleId.replace(/\?.*$/, ''))
        if (lazyPluginSrcs.has(moduleId)) {
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
