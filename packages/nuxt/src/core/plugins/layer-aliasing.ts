import { createUnplugin } from 'unplugin'
import type { NuxtConfigLayer } from 'nuxt/schema'
import { resolveAlias } from '@nuxt/kit'
import { normalize } from 'pathe'
import MagicString from 'magic-string'

interface LayerAliasingOptions {
  sourcemap?: boolean
  transform?: boolean
  layers: NuxtConfigLayer[]
}

const ALIAS_RE = /(?<=['"])[~@]{1,2}(?=\/)/g

export const LayerAliasingPlugin = createUnplugin((options: LayerAliasingOptions) => {
  const aliases = Object.fromEntries(options.layers.map(l => [l.config.srcDir || l.cwd, {
    '~': l.config?.alias?.['~'] || l.config.srcDir || l.cwd,
    '@': l.config?.alias?.['@'] || l.config.srcDir || l.cwd,
    '~~': l.config?.alias?.['~~'] || l.config.rootDir || l.cwd,
    '@@': l.config?.alias?.['@@'] || l.config.rootDir || l.cwd
  }]))
  const layers = Object.keys(aliases).sort((a, b) => b.length - a.length)

  return {
    name: 'nuxt:layer-aliasing',
    enforce: 'pre',
    vite: {
      resolveId: {
        order: 'pre',
        async handler (id, importer) {
          if (!importer) { return }

          const layer = layers.find(l => importer.startsWith(l))
          if (!layer) { return }

          const resolvedId = resolveAlias(id, aliases[layer])
          if (resolvedId !== id) {
            return await this.resolve(resolvedId, importer, { skipSelf: true })
          }
        }
      }
    },

    // webpack-only transform
    transformInclude: (id) => {
      if (!options.transform) { return false }
      const _id = normalize(id)
      return layers.some(dir => _id.startsWith(dir))
    },
    transform (code, id) {
      if (!options.transform) { return }

      const _id = normalize(id)
      const layer = layers.find(l => _id.startsWith(l))
      if (!layer || !code.match(ALIAS_RE)) { return }

      const s = new MagicString(code)
      s.replace(ALIAS_RE, r => aliases[layer][r as '~'] || r)

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap ? s.generateMap({ hires: true }) : undefined
        }
      }
    }
  }
})
