import { existsSync, readdirSync } from 'node:fs'
import { createUnplugin } from 'unplugin'
import type { NuxtConfigLayer } from 'nuxt/schema'
import { resolveAlias } from '@nuxt/kit'
import { join, normalize, relative } from 'pathe'
import MagicString from 'magic-string'

interface LayerAliasingOptions {
  sourcemap?: boolean
  transform?: boolean
  root: string
  dev: boolean
  layers: NuxtConfigLayer[]
}

const ALIAS_RE = /(?<=['"])[~@]{1,2}(?=\/)/g
const ALIAS_RE_SINGLE = /(?<=['"])[~@]{1,2}(?=\/)/

export const LayerAliasingPlugin = createUnplugin((options: LayerAliasingOptions) => {
  const aliases: Record<string, { aliases: Record<string, string>, prefix: string, publicDir: false | string }> = {}
  for (const layer of options.layers) {
    const srcDir = layer.config.srcDir || layer.cwd
    const rootDir = layer.config.rootDir || layer.cwd
    const publicDir = join(srcDir, layer.config?.dir?.public || 'public')

    aliases[srcDir] = {
      aliases: {
        '~': layer.config?.alias?.['~'] || srcDir,
        '@': layer.config?.alias?.['@'] || srcDir,
        '~~': layer.config?.alias?.['~~'] || rootDir,
        '@@': layer.config?.alias?.['@@'] || rootDir
      },
      prefix: relative(options.root, publicDir),
      publicDir: !options.dev && existsSync(publicDir) && publicDir
    }
  }
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

          const publicDir = aliases[layer].publicDir
          if (id.startsWith('/') && publicDir && readdirSync(publicDir).some(file => file === id.slice(1) || id.startsWith('/' + file + '/'))) {
            const resolvedId = '/' + join(aliases[layer].prefix, id.slice(1))
            return await this.resolve(resolvedId, importer, { skipSelf: true })
          }

          const resolvedId = resolveAlias(id, aliases[layer].aliases)
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
      if (!layer || !ALIAS_RE_SINGLE.test(code)) { return }

      const s = new MagicString(code)
      s.replace(ALIAS_RE, r => aliases[layer].aliases[r as '~'] || r)

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap ? s.generateMap({ hires: true }) : undefined
        }
      }
    }
  }
})
