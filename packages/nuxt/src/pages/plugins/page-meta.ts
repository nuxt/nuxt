import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL } from 'ufo'
import type { StaticImport } from 'mlly'
import { findExports, findStaticImports, parseStaticImport } from 'mlly'
import { walk } from 'estree-walker'
import MagicString from 'magic-string'
import { isAbsolute } from 'pathe'
import { logger } from '@nuxt/kit'

import {
  ScopeTracker,
  type ScopeTrackerNode,
  getUndeclaredIdentifiersInFunction,
  parseAndWalk,
  withLocations,
} from '../../core/utils/parse'

interface PageMetaPluginOptions {
  dev?: boolean
  sourcemap?: boolean
  isPage?: (file: string) => boolean
  routesPath?: string
}

const HAS_MACRO_RE = /\bdefinePageMeta\s*\(\s*/

const CODE_EMPTY = `
const __nuxt_page_meta = null
export default __nuxt_page_meta
`

const CODE_DEV_EMPTY = `
const __nuxt_page_meta = {}
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

export const PageMetaPlugin = (options: PageMetaPluginOptions = {}) => createUnplugin(() => {
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
              : undefined,
          }
        }
      }

      const hasMacro = HAS_MACRO_RE.test(code)

      const imports = findStaticImports(code)

      // [vite] Re-export any script imports
      const scriptImport = imports.find(i => parseMacroQuery(i.specifier).type === 'script')
      if (scriptImport) {
        const reorderedQuery = rewriteQuery(scriptImport.specifier)
        // Avoid using JSON.stringify which can add extra escapes to paths with non-ASCII characters
        const quotedSpecifier = getQuotedSpecifier(scriptImport.code)?.replace(scriptImport.specifier, reorderedQuery) ?? JSON.stringify(reorderedQuery)
        s.overwrite(0, code.length, `export { default } from ${quotedSpecifier}`)
        return result()
      }

      // [webpack] Re-export any exports from script blocks in the components
      const currentExports = findExports(code)
      for (const match of currentExports) {
        if (match.type !== 'default' || !match.specifier) {
          continue
        }

        const reorderedQuery = rewriteQuery(match.specifier)
        // Avoid using JSON.stringify which can add extra escapes to paths with non-ASCII characters
        const quotedSpecifier = getQuotedSpecifier(match.code)?.replace(match.specifier, reorderedQuery) ?? JSON.stringify(reorderedQuery)
        s.overwrite(0, code.length, `export { default } from ${quotedSpecifier}`)
        return result()
      }

      if (!hasMacro && !code.includes('export { default }') && !code.includes('__nuxt_page_meta')) {
        if (!code) {
          s.append(options.dev ? (CODE_DEV_EMPTY + CODE_HMR) : CODE_EMPTY)
          const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href))
          logger.error(`The file \`${pathname}\` is not a valid page as it has no content.`)
        } else {
          s.overwrite(0, code.length, options.dev ? (CODE_DEV_EMPTY + CODE_HMR) : CODE_EMPTY)
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
          parsed.namespacedImport,
        ].filter(Boolean) as string[]) {
          importMap.set(name, i)
        }
      }

      function isStaticIdentifier (name: string | false): name is string {
        return !!(name && importMap.has(name))
      }

      function addImport (name: string | false) {
        if (!isStaticIdentifier(name)) { return }
        const importValue = importMap.get(name)!.code.trim()
        if (!addedImports.has(importValue)) {
          addedImports.add(importValue)
        }
      }

      const declarationNodes: ScopeTrackerNode[] = []
      const addedDeclarations = new Set<string>()

      function addDeclaration (node: ScopeTrackerNode) {
        const codeSectionKey = `${node.start}-${node.end}`
        if (addedDeclarations.has(codeSectionKey)) { return }
        addedDeclarations.add(codeSectionKey)
        declarationNodes.push(node)
      }

      function addImportOrDeclaration (name: string) {
        if (isStaticIdentifier(name)) {
          addImport(name)
        } else {
          const declaration = scopeTracker.getDeclaration(name)
          if (declaration) {
            processDeclaration(declaration)
          }
        }
      }

      const scopeTracker = new ScopeTracker()

      function processDeclaration (node: ScopeTrackerNode | null) {
        if (node?.type === 'Variable') {
          addDeclaration(node)

          for (const decl of node.variableNode.declarations) {
            if (!decl.init) { continue }
            walk(decl.init, {
              enter: (node) => {
                if (node.type === 'AwaitExpression') {
                  logger.error(`[nuxt] Await expressions are not supported in definePageMeta. File: '${id}'`)
                  throw new Error('await in definePageMeta')
                }
                if (node.type !== 'Identifier') { return }

                addImportOrDeclaration(node.name)
              },
            })
          }
        } else if (node?.type === 'Function') {
          // arrow functions are going to be assigned to a variable
          if (node.node.type === 'ArrowFunctionExpression') { return }
          const name = node.node.id?.name
          if (!name) { return }
          addDeclaration(node)

          const undeclaredIdentifiers = getUndeclaredIdentifiersInFunction(node.node)
          for (const name of undeclaredIdentifiers) {
            addImportOrDeclaration(name)
          }
        }
      }

      parseAndWalk(code, id, {
        scopeTracker,
        enter: (node) => {
          if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') { return }
          if (!('name' in node.callee) || node.callee.name !== 'definePageMeta') { return }

          const meta = withLocations(node.arguments[0])

          if (!meta) { return }

          walk(meta, {
            enter (node) {
              if (node.type !== 'Identifier') { return }

              if (isStaticIdentifier(node.name)) {
                addImport(node.name)
              } else {
                processDeclaration(scopeTracker.getDeclaration(node.name))
              }
            },
          })

          const importStatements = Array.from(addedImports).join('\n')

          const declarations = declarationNodes
            .sort((a, b) => a.start - b.start)
            .map(node => code.slice(node.start, node.end))
            .join('\n')

          const extracted = [
            importStatements,
            declarations,
            `const __nuxt_page_meta = ${code!.slice(meta.start, meta.end) || 'null'}\nexport default __nuxt_page_meta` + (options.dev ? CODE_HMR : ''),
          ].join('\n')

          s.overwrite(0, code.length, extracted.trim())
        },
      })

      if (!s.hasChanged() && !code.includes('__nuxt_page_meta')) {
        s.overwrite(0, code.length, options.dev ? (CODE_DEV_EMPTY + CODE_HMR) : CODE_EMPTY)
      }

      return result()
    },
    vite: {
      handleHotUpdate: {
        order: 'post',
        handler: ({ file, modules, server }) => {
          if (options.isPage?.(file)) {
            const macroModule = server.moduleGraph.getModuleById(file + '?macro=true')
            const routesModule = server.moduleGraph.getModuleById('virtual:nuxt:' + options.routesPath)
            return [
              ...modules,
              ...macroModule ? [macroModule] : [],
              ...routesModule ? [routesModule] : [],
            ]
          }
        },
      },
    },
  }
})

// https://github.com/vuejs/vue-loader/pull/1911
// https://github.com/vitejs/vite/issues/8473
const QUERY_START_RE = /^\?/
const MACRO_RE = /&macro=true/
function rewriteQuery (id: string) {
  return id.replace(/\?.+$/, r => '?macro=true&' + r.replace(QUERY_START_RE, '').replace(MACRO_RE, ''))
}

function parseMacroQuery (id: string) {
  const { search } = parseURL(decodeURIComponent(isAbsolute(id) ? pathToFileURL(id).href : id).replace(/\?macro=true$/, ''))
  const query = parseQuery(search)
  if (id.includes('?macro=true')) {
    return { macro: 'true', ...query }
  }
  return query
}

const QUOTED_SPECIFIER_RE = /(["']).*\1/
function getQuotedSpecifier (id: string) {
  return id.match(QUOTED_SPECIFIER_RE)?.[0]
}
