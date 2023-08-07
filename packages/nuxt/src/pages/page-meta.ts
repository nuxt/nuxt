import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL } from 'ufo'
import type { StaticImport } from 'mlly'
import { findExports, findStaticImports, parseStaticImport } from 'mlly'
import type { CallExpression, Expression, Identifier } from 'estree'
import type { Node } from 'estree-walker'
import { walk } from 'estree-walker'
import MagicString from 'magic-string'
import { isAbsolute } from 'pathe'

export interface PageMetaPluginOptions {
  dev?: boolean
  sourcemap?: boolean
}

const HAS_MACRO_RE = /\bdefinePageMeta\s*\(\s*/

const CODE_EMPTY = `
const __nuxt_page_meta = null
export default __nuxt_page_meta
`

const CODE_HMR = `
// Vite
if (import.meta.hot) {
  import.meta.hot.accept(mod => {
    Object.assign(__nuxt_page_meta, mod)
  })
}
// webpack
if (import.meta.webpackHot) {
  import.meta.webpackHot.accept((err) => {
    if (err) { window.location = window.location.href }
  })
}`

export const PageMetaPlugin = createUnplugin((options: PageMetaPluginOptions) => {
  return {
    name: 'nuxt:pages-macros-transform',
    enforce: 'post',
    transformInclude (id) {
      return !!parseMacroQuery(id).macro
    },
    transform (code, id) {
      const query = parseMacroQuery(id)
      if (query.type && query.type !== 'script') { return }

      const s = new MagicString(code)
      function result () {
        if (s.hasChanged()) {
          return {
            code: s.toString(),
            map: options.sourcemap
              ? s.generateMap({ hires: true })
              : undefined
          }
        }
      }

      const hasMacro = HAS_MACRO_RE.test(code)

      const imports = findStaticImports(code)

      // [vite] Re-export any script imports
      const scriptImport = imports.find(i => parseMacroQuery(i.specifier).type === 'script')
      if (scriptImport) {
        const specifier = rewriteQuery(scriptImport.specifier)
        s.overwrite(0, code.length, `export { default } from ${JSON.stringify(specifier)}`)
        return result()
      }

      // [webpack] Re-export any exports from script blocks in the components
      const currentExports = findExports(code)
      for (const match of currentExports) {
        if (match.type !== 'default' || !match.specifier) {
          continue
        }

        const specifier = rewriteQuery(match.specifier)
        s.overwrite(0, code.length, `export { default } from ${JSON.stringify(specifier)}`)
        return result()
      }

      if (!hasMacro && !code.includes('export { default }') && !code.includes('__nuxt_page_meta')) {
        if (!code) {
          s.append(CODE_EMPTY + (options.dev ? CODE_HMR : ''))
          const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href))
          console.error(`The file \`${pathname}\` is not a valid page as it has no content.`)
        } else {
          s.overwrite(0, code.length, CODE_EMPTY + (options.dev ? CODE_HMR : ''))
        }

        return result()
      }

      const importMap = new Map<string, StaticImport>()
      const addedImports = new Set()
      for (const i of imports) {
        const parsed = parseStaticImport(i)
        for (const name of [
          parsed.defaultImport,
          ...Object.values(parsed.namedImports || {}),
          parsed.namespacedImport
        ].filter(Boolean) as string[]) {
          importMap.set(name, i)
        }
      }

      walk(this.parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest'
      }) as Node, {
        enter (_node) {
          if (_node.type !== 'CallExpression' || (_node as CallExpression).callee.type !== 'Identifier') { return }
          const node = _node as CallExpression & { start: number, end: number }
          const name = 'name' in node.callee && node.callee.name
          if (name !== 'definePageMeta') { return }

          const meta = node.arguments[0] as Expression & { start: number, end: number }

          let contents = `const __nuxt_page_meta = ${code!.slice(meta.start, meta.end) || 'null'}\nexport default __nuxt_page_meta` + (options.dev ? CODE_HMR : '')

          function addImport (name: string | false) {
            if (name && importMap.has(name)) {
              const importValue = importMap.get(name)!.code
              if (!addedImports.has(importValue)) {
                contents = importMap.get(name)!.code + '\n' + contents
                addedImports.add(importValue)
              }
            }
          }

          walk(meta, {
            enter (_node) {
              if (_node.type === 'CallExpression') {
                const node = _node as CallExpression & { start: number, end: number }
                addImport('name' in node.callee && node.callee.name)
              }
              if (_node.type === 'Identifier') {
                const node = _node as Identifier & { start: number, end: number }
                addImport(node.name)
              }
            }
          })

          s.overwrite(0, code.length, contents)
        }
      })

      if (!s.hasChanged() && !code.includes('__nuxt_page_meta')) {
        s.overwrite(0, code.length, CODE_EMPTY + (options.dev ? CODE_HMR : ''))
      }

      return result()
    },
    vite: {
      handleHotUpdate: {
        order: 'pre',
        handler: ({ modules }) => {
          // Remove macro file from modules list to prevent HMR overrides
          const index = modules.findIndex(i => i.id?.includes('?macro=true'))
          if (index !== -1) {
            modules.splice(index, 1)
          }
        }
      }
    }
  }
})

// https://github.com/vuejs/vue-loader/pull/1911
// https://github.com/vitejs/vite/issues/8473
function rewriteQuery (id: string) {
  return id.replace(/\?.+$/, r => '?macro=true&' + r.replace(/^\?/, '').replace(/&macro=true/, ''))
}

function parseMacroQuery (id: string) {
  const { search } = parseURL(decodeURIComponent(isAbsolute(id) ? pathToFileURL(id).href : id).replace(/\?macro=true$/, ''))
  const query = parseQuery(search)
  if (id.includes('?macro=true')) {
    return { macro: 'true', ...query }
  }
  return query
}
