import MagicString from 'magic-string'
import { createUnimport } from 'unimport'
import { createUnplugin } from 'unplugin'
import { normalize, resolve } from 'pathe'
import type { Nuxt } from 'nuxt/schema'

import { JS_ID_RE, VUE_SCRIPT_TEMPLATE_ID_FILTER } from '../utils/plugins.ts'

const DOLLAR_FETCH_RE = /\$fetch\b/
const GLOBAL_DOLLAR_FETCH_RE = /\b(?:globalThis|window|self)\s*\??\.\s*\$fetch\b|\b(?:globalThis|window|self)(?:\?\.)?\[\s*(['"`])\$fetch\1\s*\]/
const ESM_RE = /(?:^|[\s;}])(?:import|export)\b/
const CJS_RE = /\b(?:module\.exports|exports\.\w+\s*=|require\s*\()/
const OFETCH_RE = /[\\/]node_modules[\\/]ofetch[\\/]/
const VIRTUAL_PREFIX_RE = /^\/?virtual:nuxt:/

/**
 * Install the `$fetch` global in the client build only where client code reads it: a module
 * that refers to `$fetch` without declaring or importing it, or that reads it from `globalThis`,
 * `window` or `self`, imports `#build/fetch-global` ahead of its own code.
 */
export const DollarFetchGlobalPlugin = (nuxt: Nuxt) => createUnplugin(() => {
  const ctx = createUnimport({
    parser: 'oxc',
    imports: [{ name: '$fetch', from: '#build/fetch' }],
    addons: { addons: [] },
  })
  const buildDir = normalize(nuxt.options.buildDir)
  const fetchTemplates = new Set(['fetch.client.mjs', 'fetch-global.mjs'].map(file => `${buildDir}/${file}`))

  return {
    name: 'nuxt:fetch-global',
    enforce: 'post',
    transform: {
      filter: {
        id: { include: [...VUE_SCRIPT_TEMPLATE_ID_FILTER, JS_ID_RE] },
        code: { include: DOLLAR_FETCH_RE },
      },
      async handler (code, id) {
        const path = id.replace(/\?.*$/, '')
        const file = VIRTUAL_PREFIX_RE.test(path)
          ? resolve(nuxt.options.rootDir, decodeURIComponent(path.replace(VIRTUAL_PREFIX_RE, '')))
          : normalize(path)
        if (fetchTemplates.has(file) || OFETCH_RE.test(file) || (!ESM_RE.test(code) && CJS_RE.test(code))) {
          return
        }
        if (!GLOBAL_DOLLAR_FETCH_RE.test(code)) {
          const { matchedImports } = await ctx.detectImports(code)
          if (!matchedImports.length) {
            return
          }
        }
        const s = new MagicString(code)
        s.prepend('import \'#build/fetch-global\';\n')
        return {
          code: s.toString(),
          map: nuxt.options.sourcemap.client ? s.generateMap({ hires: true }) : undefined,
        }
      },
    },
  }
})
