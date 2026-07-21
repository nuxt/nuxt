import { type UnpluginOptions, createUnplugin } from 'unplugin'
import { resolveAlias } from '@nuxt/kit'
import { normalize } from 'pathe'
import { generateTransform, rolldownString } from 'rolldown-string'
import type { NuxtConfigLayer } from 'nuxt/schema'

interface LayerAliasingOptions {
  root: string
  dev: boolean
  layers: NuxtConfigLayer[]
}

const ALIAS_RE = /(?<=['"])[~@]{1,2}(?=\/)/g
const ALIAS_RE_SINGLE = /(?<=['"])[~@]{1,2}(?=\/)/
const ALIAS_ID_RE = /^[~@]{1,2}\//
const CSS_LANG_RE = /\.(?:css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:\?|$)/

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

  // On vite, JS imports are handled by the `resolveId` hook below; the
  // textual rewrite is only needed for CSS files, whose `@import` / `url()`
  // resolution skips plugin `resolveId`. Webpack/rspack rely on the textual
  // rewrite for everything.
  const isCssLikeOnly = meta.framework === 'vite'
  const transformInclude: UnpluginOptions['transformInclude'] = (id) => {
    const _id = normalize(id)
    if (!layers.some(dir => _id.startsWith(dir))) { return false }
    if (isCssLikeOnly && !CSS_LANG_RE.test(id)) { return false }
    return true
  }
  const transform: UnpluginOptions['transform'] = {
    filter: {
      code: { include: ALIAS_RE_SINGLE },
    },
    handler (code, id, meta?: unknown) {
      const _id = normalize(id)
      const layer = layers.find(l => _id.startsWith(l))
      if (!layer) { return }

      const s = rolldownString(code, id, meta)
      for (const match of code.matchAll(ALIAS_RE)) {
        const replacement = aliases[layer]?.[match[0] as '~']
        if (replacement && replacement !== match[0]) {
          s.overwrite(match.index, match.index + match[0].length, replacement)
        }
      }

      return generateTransform(s, id)
    },
  }

  return {
    name: 'nuxt:layer-aliasing',
    enforce: 'pre',
    vite: {
      resolveId: {
        order: 'pre',
        filter: {
          id: ALIAS_ID_RE,
        },
        handler (id, importer) {
          if (!importer) { return }

          const layer = layers.find(l => importer.startsWith(l))
          if (!layer) { return }

          const resolvedId = resolveAlias(id, aliases[layer])
          if (resolvedId !== id) {
            return this.resolve(resolvedId, importer, { skipSelf: true })
          }
        },
      },
    },

    // https://github.com/nuxt/nuxt/issues/24427
    transformInclude,
    transform,
  }
})
