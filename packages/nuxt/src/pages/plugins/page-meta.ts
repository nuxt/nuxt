import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { generateTransform, rolldownString } from 'rolldown-string'
import { ScopeTracker, getUndeclaredIdentifiersInFunction, isReferenceIdentifier, walk } from 'oxc-walker'
import type { ScopeTrackerNode } from 'oxc-walker'

import { pageDiagnostics } from '@nuxt/kit/internal'
import { parseModuleId } from '../../core/utils/plugins.ts'
import { parseModule } from '../../core/utils/parse.ts'
import { getStaticImports } from '../../core/utils/static-imports.ts'
import type { ParsedStaticImport } from '../../core/utils/static-imports.ts'
import { classifyPageMetaProperty } from '../utils.ts'
import { linkToAlias } from '../../utils.ts'
import type { ESTree, ParserOptions } from 'rolldown/utils'

interface PageMetaPluginOptions {
  dev?: boolean
  isPage?: (file: string) => boolean
  routesId?: string
  extractedKeys?: string[]
  extractSerializable?: boolean
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
  const extractedKeys = new Set(options.extractedKeys)
  const classifyOptions = { extractSerializable: options.extractSerializable }

  return {
    name: 'nuxt:pages-macros-transform',
    enforce: 'post',
    transform: {
      filter: {
        id: {
          include: /[?&]macro=true\b/,
          exclude: [/(?:\?|%3F).*type=(?:style|template)/],
        },
        code: {
          include: [
            HAS_MACRO_RE,
            /\bfrom\s+["'][^"'?]*\?[^"']*type=script[^"']*["']/,
            /export\s+\{\s*default\s*\}\s+from\s+["'][^"'?]*\?[^"']*type=script[^"']*["']/,
            /^(?!.*__nuxt_page_meta)(?!.*export\s+\{\s*default\s*\})(?!.*\bdefinePageMeta\s*\()[\s\S]*$/,
          ],
        },
      },
      handler (code, id, transformMeta?: unknown) {
        const query = parseMacroQuery(id)
        if (query.type && query.type !== 'script') { return }

        const s = rolldownString(code, id, transformMeta)
        function result () {
          return generateTransform(s, id)
        }

        const hasMacro = HAS_MACRO_RE.test(code)

        const parsed = parseModule(code, id, { lang: query.lang ?? 'ts' })
        const imports = getStaticImports(code, parsed.module.staticImports)

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
        for (const statement of parsed.module.staticExports) {
          const defaultEntry = statement.entries.find(entry => !entry.isType && entry.exportName.name === 'default')
          const specifier = defaultEntry?.moduleRequest?.value
          if (!specifier) {
            continue
          }

          const reorderedQuery = rewriteQuery(specifier)
          // Avoid using JSON.stringify which can add extra escapes to paths with non-ASCII characters
          const statementCode = code.slice(statement.start, statement.end)
          const quotedSpecifier = getQuotedSpecifier(statementCode)?.replace(specifier, reorderedQuery) ?? JSON.stringify(reorderedQuery)
          s.overwrite(0, code.length, `export { default } from ${quotedSpecifier}`)
          return result()
        }

        if (!hasMacro && !code.includes('export { default }') && !code.includes('__nuxt_page_meta')) {
          if (!code) {
            s.append(options.dev ? (CODE_DEV_EMPTY + CODE_HMR) : CODE_EMPTY)
            const { pathname } = parseModuleId(id)
            pageDiagnostics.NUXT_B4001({ pathname: linkToAlias(pathname) })
          } else {
            s.overwrite(0, code.length, options.dev ? (CODE_DEV_EMPTY + CODE_HMR) : CODE_EMPTY)
          }

          return result()
        }

        const importMap = new Map<string, ParsedStaticImport>()
        const addedImports = new Set()
        for (const i of imports) {
          for (const name of [
            i.defaultImport,
            ...Object.values(i.namedImports),
            i.namespacedImport,
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

              // `isReferenceIdentifier` cannot distinguish identifiers in destructured binding
              // patterns (`({ foo }) => foo`) from references, and references to locals of
              // functions within the initializer must not resolve to same-named declarations
              // in the outer scope, so track the initializer's own scopes to filter them out
              const initScopeTracker = new ScopeTracker({
                preserveExitedScopes: true,
              })
              walk(decl.init, { scopeTracker: initScopeTracker })
              initScopeTracker.freeze()

              walk(decl.init, {
                scopeTracker: initScopeTracker,
                enter: (node, parent) => {
                  if (node.type === 'AwaitExpression') {
                    const codeSnippet = code.slice(node.start, Math.min(node.end, node.start + 80))
                    throw pageDiagnostics.NUXT_B4002({ codeSnippet, offset: node.start })
                  }
                  if (
                    !isReferenceIdentifier(node, parent)
                  || node.type !== 'Identifier' // checking for `node.type` to narrow down the type
                  || initScopeTracker.isDeclared(node.name)
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

        const { program: ast } = parsed
        walk(ast, { scopeTracker })

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
              const omitProp = (prop: ESTree.ObjectPropertyKind, i: number) => {
                const nextProperty = meta.properties[i + 1]
                if (nextProperty) {
                  m.overwrite(prop.start - meta.start, nextProperty.start - meta.start, '')
                } else if (code[prop.end] === ',') {
                  m.overwrite(prop.start - meta.start, prop.end - meta.start + 1, '')
                } else {
                  m.overwrite(prop.start - meta.start, prop.end - meta.start, '')
                }
              }

              for (let i = 0; i < meta.properties.length; i++) {
                const prop = meta.properties[i]!
                const classification = classifyPageMetaProperty(prop, extractedKeys, classifyOptions)

                // The route record now carries the value, so drop it here to keep the two in step.
                if (classification.kind === 'extract' || (classification.kind === 'reshape' && classification.value)) {
                  omitProp(prop, i)
                  continue
                }

                if (classification.kind !== 'reshape') {
                  continue
                }

                for (const layoutProp of classification.node.properties) {
                  if (layoutProp.type !== 'Property' || layoutProp.key.type !== 'Identifier') {
                    continue
                  }
                  if (layoutProp.key.name === 'name') {
                    m.appendLeft(
                      prop.start - meta.start,
                      `layout: ${code.slice(layoutProp.value.start, layoutProp.value.end)},\n`,
                    )
                  } else if (layoutProp.key.name === 'props') {
                    m.appendLeft(
                      prop.start - meta.start,
                      `layoutProps: ${code.slice(layoutProp.value.start, layoutProp.value.end)},\n`,
                    )
                  }
                }
                omitProp(prop, i)
              }
            }

            const definePageMetaScope = scopeTracker.getCurrentScope()

            walk(meta, {
              scopeTracker,
              enter (node, parent) {
                if (
                  !isReferenceIdentifier(node, parent)
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
          throw pageDiagnostics.NUXT_B4003({ callCount: instances, file: linkToAlias(id) })
        }

        if (!s.hasChanged() && !code.includes('__nuxt_page_meta')) {
          s.overwrite(0, code.length, options.dev ? (CODE_DEV_EMPTY + CODE_HMR) : CODE_EMPTY)
        }

        return result()
      },
    },
    vite: {
      handleHotUpdate: {
        order: 'post',
        handler: ({ file, modules, server }) => {
          if (options.routesId && options.isPage?.(file)) {
            const macroModule = server.moduleGraph.getModuleById(file + '?macro=true')
            const routesModule = server.moduleGraph.getModuleById(options.routesId)
            // Reload the real module when Vite selects its macro counterpart (#30709).
            const realModules = []
            for (const mod of modules) {
              if (mod.id && MACRO_STRIP_RE.test(mod.id)) {
                const realModule = server.moduleGraph.getModuleById(mod.id.replace(MACRO_STRIP_RE, r => r.endsWith('&') ? '?' : ''))
                if (realModule) {
                  realModules.push(realModule)
                }
              }
            }
            return [
              ...modules,
              ...realModules,
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
// https://github.com/vitejs/vite-plugin-vue/issues/23
const QUERY_START_RE = /^\?/
const MACRO_RE = /&macro=true/
function rewriteQuery (id: string) {
  return id.replace(/\?.+$/, r => '?macro=true&' + r.replace(QUERY_START_RE, '').replace(MACRO_RE, ''))
}

const MACRO_QUERY_RE = /[?&]macro=true(?:&|$)/
const MACRO_STRIP_RE = /\?macro=true&?/
const TYPE_PARAM_RE = /[?&]type=([^?&]+)/
const LANG_PARAM_RE = /[?&]lang=([^?&]+)/
function parseMacroQuery (id: string) {
  const { search } = parseModuleId(id)
  const query: { macro?: string, type?: string, lang?: ParserOptions['lang'] } = {
    type: TYPE_PARAM_RE.exec(search)?.[1],
    lang: LANG_PARAM_RE.exec(search)?.[1] as ParserOptions['lang'] ?? undefined,
  }
  if (MACRO_QUERY_RE.test(search)) {
    query.macro = 'true'
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
