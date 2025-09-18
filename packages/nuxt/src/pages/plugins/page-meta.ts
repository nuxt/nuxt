import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL } from 'ufo'
import type { ParsedQuery } from 'ufo'
import type { StaticImport } from 'mlly'
import { findExports, findStaticImports, parseStaticImport } from 'mlly'
import MagicString from 'magic-string'
import { isAbsolute } from 'pathe'
import { ScopeTracker, getUndeclaredIdentifiersInFunction, isBindingIdentifier, parseAndWalk, walk } from 'oxc-walker'
import type { ScopeTrackerNode } from 'oxc-walker'

import { logger } from '../../utils'
import { isSerializable } from '../utils'
import type { ParserOptions } from 'oxc-parser'

interface PageMetaPluginOptions {
  dev?: boolean
  sourcemap?: boolean
  isPage?: (file: string) => boolean
  routesPath?: string
  extractedKeys?: string[]
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
        const codeSectionKey = `${resolveStart(node)}-${resolveEnd(node)}`
        if (addedDeclarations.has(codeSectionKey)) { return }
        addedDeclarations.add(codeSectionKey)
        declarationNodes.push(node)
      }

      /**
       * Adds an import or a declaration to the extracted code.
       * @param name The name of the import or declaration to add.
       * @param node The node that is currently being processed. (To detect self-references)
       */
      function addImportOrDeclaration (name: string, node?: ScopeTrackerNode) {
        if (isStaticIdentifier(name)) {
          addImport(name)
        } else {
          const declaration = scopeTracker.getDeclaration(name)
          /*
           Without checking for `declaration !== node`, we would end up in an infinite loop
           when, for example, a variable is declared and then used in its own initializer.
           (we shouldn't mask the underlying error by throwing a `Maximum call stack size exceeded` error)

           ```ts
           const a = { b: a }
           ```
           */
          if (declaration && declaration !== node) {
            processDeclaration(declaration)
          }
        }
      }

      const scopeTracker = new ScopeTracker({
        preserveExitedScopes: true,
      })

      function processDeclaration (scopeTrackerNode: ScopeTrackerNode | null) {
        if (scopeTrackerNode?.type === 'Variable') {
          addDeclaration(scopeTrackerNode)

          for (const decl of scopeTrackerNode.variableNode.declarations) {
            if (!decl.init) { continue }
            walk(decl.init, {
              enter: (node, parent) => {
                if (node.type === 'AwaitExpression') {
                  logger.error(`Await expressions are not supported in definePageMeta. File: '${id}'`)
                  throw new Error('await in definePageMeta')
                }
                if (
                  isBindingIdentifier(node, parent)
                  || node.type !== 'Identifier' // checking for `node.type` to narrow down the type
                ) { return }

                addImportOrDeclaration(node.name, scopeTrackerNode)
              },
            })
          }
        } else if (scopeTrackerNode?.type === 'Function') {
          // arrow functions are going to be assigned to a variable
          if (scopeTrackerNode.node.type === 'ArrowFunctionExpression') { return }
          const name = scopeTrackerNode.node.id?.name
          if (!name) { return }
          addDeclaration(scopeTrackerNode)

          const undeclaredIdentifiers = getUndeclaredIdentifiersInFunction(scopeTrackerNode.node)
          for (const name of undeclaredIdentifiers) {
            addImportOrDeclaration(name)
          }
        }
      }

      const { program: ast } = parseAndWalk(code, id, {
        scopeTracker,
        parseOptions: {
          lang: query.lang ?? 'ts',
        },
      })

      scopeTracker.freeze()

      let instances = 0

      walk(ast, {
        scopeTracker,
        enter: (node) => {
          if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') { return }
          if (!('name' in node.callee) || node.callee.name !== 'definePageMeta') { return }

          instances++
          const meta = node.arguments[0]

          if (!meta) { return }
          const metaCode = code!.slice(meta.start, meta.end)
          const m = new MagicString(metaCode)

          if (meta.type === 'ObjectExpression') {
            for (let i = 0; i < meta.properties.length; i++) {
              const prop = meta.properties[i]!
              if (prop.type === 'Property' && prop.key.type === 'Identifier' && options.extractedKeys?.includes(prop.key.name)) {
                const { serializable } = isSerializable(metaCode, prop.value)
                if (!serializable) {
                  continue
                }
                const nextProperty = meta.properties[i + 1]
                if (nextProperty) {
                  m.overwrite(prop.start - meta.start, nextProperty.start - meta.start, '')
                } else if (code[prop.end] === ',') {
                  m.overwrite(prop.start - meta.start, prop.end - meta.start + 1, '')
                } else {
                  m.overwrite(prop.start - meta.start, prop.end - meta.start, '')
                }
              }
            }
          }

          const definePageMetaScope = scopeTracker.getCurrentScope()

          walk(meta, {
            scopeTracker,
            enter (node, parent) {
              if (
                isBindingIdentifier(node, parent)
                || node.type !== 'Identifier' // checking for `node.type` to narrow down the type
              ) { return }

              const declaration = scopeTracker.getDeclaration(node.name)
              if (declaration) {
                // check if the declaration was made inside `definePageMeta` and if so, do not process it
                // (ensures that we don't hoist local variables in inline middleware, for example)
                if (
                  declaration.isUnderScope(definePageMetaScope)
                  // ensures that we compare the correct declaration to the reference
                  // (when in the same scope, the declaration must come before the reference, otherwise it must be in a parent scope)
                  && (scopeTracker.isCurrentScopeUnder(declaration.scope) || resolveStart(declaration) < node.start)
                ) {
                  return
                }
              }

              if (isStaticIdentifier(node.name)) {
                addImport(node.name)
              } else if (declaration) {
                processDeclaration(declaration)
              }
            },
          })

          const importStatements = Array.from(addedImports).join('\n')

          const declarations = declarationNodes
            .sort((a, b) => resolveStart(a) - resolveStart(b))
            .map(node => code.slice(resolveStart(node), resolveEnd(node)))
            .join('\n')

          const extracted = [
            importStatements,
            declarations,
            `const __nuxt_page_meta = ${m.toString() || 'null'}\nexport default __nuxt_page_meta` + (options.dev ? CODE_HMR : ''),
          ].join('\n')

          s.overwrite(0, code.length, extracted.trim())
        },
      })

      if (instances > 1) {
        throw new Error('Multiple `definePageMeta` calls are not supported. File: ' + id.replace(/\?.+$/, ''))
      }

      if (!s.hasChanged() && !code.includes('__nuxt_page_meta')) {
        s.overwrite(0, code.length, options.dev ? (CODE_DEV_EMPTY + CODE_HMR) : CODE_EMPTY)
      }

      return result()
    },
    vite: {
      handleHotUpdate: {
        order: 'post',
        handler: ({ file, modules, server }) => {
          if (options.routesPath && options.isPage?.(file)) {
            const macroModule = server.moduleGraph.getModuleById(file + '?macro=true')
            const routesModule = server.moduleGraph.getModuleById('virtual:nuxt:' + encodeURIComponent(options.routesPath))
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
  const query = parseQuery<{
    lang?: ParserOptions['lang']
  } & ParsedQuery>(search)
  if (id.includes('?macro=true')) {
    return { macro: 'true', ...query }
  }
  return query
}

const QUOTED_SPECIFIER_RE = /(["']).*\1/
function getQuotedSpecifier (id: string) {
  return id.match(QUOTED_SPECIFIER_RE)?.[0]
}

function resolveStart (node: ScopeTrackerNode) {
  return 'fnNode' in node ? node.fnNode.start : node.start
}
function resolveEnd (node: ScopeTrackerNode) {
  return 'fnNode' in node ? node.fnNode.end : node.end
}
