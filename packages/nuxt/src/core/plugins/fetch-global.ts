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
// vite passes `virtual:nuxt:<path>`; webpack and rspack pass a file path ending in the encoded id
const VIRTUAL_ID_RE = /virtual(:|%3A)nuxt\1([^/\\]+)$/i

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
  const fetchTemplates = new Set(['fetch.mjs', 'fetch.client.mjs', 'fetch-global.mjs'].map(file => `${buildDir}/${file}`))

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
        const virtual = path.match(VIRTUAL_ID_RE)
        const file = virtual
          ? resolve(nuxt.options.rootDir, decodeURIComponent(virtual[1] === ':' ? virtual[2]! : decodeURIComponent(virtual[2]!)))
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
