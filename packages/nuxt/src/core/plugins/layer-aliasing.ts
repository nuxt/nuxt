import { createUnplugin, type UnpluginOptions } from 'unplugin'
import { resolveAlias } from '@nuxt/kit'
import { normalize } from 'pathe'
import MagicString from 'magic-string'
import type { NuxtConfigLayer } from 'nuxt/schema'

interface LayerAliasingOptions {
  sourcemap?: boolean
  root: string
  dev: boolean
  layers: NuxtConfigLayer[]
}

const ALIAS_RE = /(?<=['"])[~@]{1,2}(?=\/)/g
const ALIAS_RE_SINGLE = /(?<=['"])[~@]{1,2}(?=\/)/

export const LayerAliasingPlugin = (options: LayerAliasingOptions) => createUnplugin((_options, meta) => {
  const aliases: Record<string, Record<string, string>> = {}
  for (const layer of options.layers) {
    const srcDir = layer.config.srcDir || layer.cwd
    const rootDir = layer.config.rootDir || layer.cwd

    aliases[srcDir] = {
      '~': layer.config?.alias?.['~'] || srcDir,
      '@': layer.config?.alias?.['@'] || srcDir,
      '~~': layer.config?.alias?.['~~'] || rootDir,
      '@@': layer.config?.alias?.['@@'] || rootDir,
    }
  }
  const layers = Object.keys(aliases).sort((a, b) => b.length - a.length)

  const nonViteTransformIncludes: UnpluginOptions['transformInclude'] =  (id) => {
      const _id = normalize(id)
      return layers.some(dir => _id.startsWith(dir))
  }
  const nonViteTransform: UnpluginOptions['transform'] = {
      filter: {
        code: { include: ALIAS_RE_SINGLE },
      },
      handler (code, id) {
        const _id = normalize(id)
        const layer = layers.find(l => _id.startsWith(l))
        if (!layer) { return }

        const s = new MagicString(code)
        s.replace(ALIAS_RE, r => aliases[layer]?.[r as '~'] || r)

        if (s.hasChanged()) {
          return {
            code: s.toString(),
            map: options.sourcemap ? s.generateMap({ hires: true }) : undefined,
          }
        }
      },
  }

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
        },
      },
    },

    // webpack-only transform
    transformInclude: meta.framework !== 'vite' ? nonViteTransformIncludes : undefined,
    transform: meta.framework !== 'vite' ? nonViteTransform : undefined,
  }
})
