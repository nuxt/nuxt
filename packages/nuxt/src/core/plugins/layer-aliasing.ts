import { type UnpluginOptions, createUnplugin } from 'unplugin'
import escapeStringRegexp from 'escape-string-regexp'
import { resolveAlias } from '@nuxt/kit'
import { normalize } from 'pathe'
import { generateTransform, rolldownString } from 'rolldown-string'
import type { NuxtConfigLayer } from 'nuxt/schema'
import type { Rolldown } from 'vite'

interface LayerAliasingOptions {
  root: string
  dev: boolean
  layers: NuxtConfigLayer[]
}

const ALIAS_RE = /(?<=['"])[~@]{1,2}(?=\/)/g
const ALIAS_RE_SINGLE = /(?<=['"])[~@]{1,2}(?=\/)/
const ALIAS_ID_RE = /^[~@]{1,2}\//
// the dependency scan imports `<script>` blocks of `.vue` files through this prefix
const SCAN_VIRTUAL_MODULE_RE = /^virtual-module:/
const CSS_LANG_PATTERN = '\\.(?:css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:\\?|$)'

export const LayerAliasingPlugin = (options: LayerAliasingOptions) => createUnplugin((_options, meta) => {
  const aliases: Record<string, Record<string, string>> = {}
  for (const layer of options.layers) {
    const srcDir = layer.config.srcDir || layer.cwd
    const rootDir = layer.config.rootDir || layer.cwd

    aliases[normalize(srcDir).replace(/\/?$/, '/')] = {
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
  const layerIdREs = layers.map(dir => new RegExp(
    '^' + escapeStringRegexp(dir).replace(/\//g, '[\\\\/]') + (isCssLikeOnly ? '.*' + CSS_LANG_PATTERN : ''),
  ))
  const transform: UnpluginOptions['transform'] = {
    filter: {
      id: { include: layerIdREs },
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

  const resolveId = {
    order: 'pre',
    filter: {
      id: ALIAS_ID_RE,
    },
    handler (id, importer) {
      if (!importer) { return }

      const _importer = normalize(importer.replace(SCAN_VIRTUAL_MODULE_RE, ''))
      const layer = layers.find(l => _importer.startsWith(l))
      if (!layer) { return }

      const resolvedId = resolveAlias(id, aliases[layer])
      if (resolvedId !== id) {
        return this.resolve(resolvedId, importer, { skipSelf: true })
      }
    },
  } satisfies Rolldown.Plugin['resolveId']

  return {
    name: 'nuxt:layer-aliasing',
    enforce: 'pre',
    vite: {
      resolveId,
      // the dependency optimizer treats `@/` imports as packages unless resolved here
      configEnvironment: () => ({
        optimizeDeps: {
          rolldownOptions: {
            plugins: [{ name: 'nuxt:layer-aliasing', resolveId }],
          },
        },
      }),
    },

    // https://github.com/nuxt/nuxt/issues/24427
    transform,
  }
})
