import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { hash } from 'ohash'
import { parseQuery, parseURL } from 'ufo'
import { isAbsolute, join, parse } from 'pathe'
import { camelCase } from 'scule'
import escapeRE from 'escape-string-regexp'
import { findStaticImports, parseStaticImport } from 'mlly'
import { ScopeTracker, type ScopeTrackerNode, parseAndWalk, walk } from 'oxc-walker'
import { resolveAlias } from '@nuxt/kit'
import type { KeyedFunction } from '@nuxt/schema'
import { isWhitespace, logger, stripExtension } from '../../utils'
import type { Node } from 'oxc-parser'

import {
  type FunctionCallMetadata,
  parseStaticExportIdentifiers,
  parseStaticFunctionCall,
  processImports,
} from '../parse-utils'

interface KeyedFunctionsOptions {
  sourcemap: boolean
  keyedFunctions: KeyedFunction[]
  alias: Record<string, string>
}

const stringTypes: Array<string | undefined> = ['Literal', 'TemplateLiteral']
const NUXT_LIB_RE = /node_modules\/(?:nuxt|nuxt3|nuxt-nightly|@nuxt)\//
const SUPPORTED_EXT_RE = /\.(?:m?[jt]sx?|vue)/
const SCRIPT_RE = /(?<=<script[^>]*>)[\s\S]*?(?=<\/script>)/i

export function shouldTransformFile (id: string, extensions: RegExp | readonly string[]) {
  const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
  return !NUXT_LIB_RE.test(pathname)
    && (
      extensions instanceof RegExp
        ? extensions.test(pathname)
        : new RegExp(`\\.(${extensions.join('|')})$`).test(pathname)
    )
    && parseQuery(search).type !== 'style' && !parseQuery(search).macro
}

export const KeyedFunctionsPlugin = (options: KeyedFunctionsOptions) => createUnplugin(() => {
  // DO NOT USE IN TRANSFORM - this is a global copy that doesn't include local import names
  // - the `source`s have resolved aliases and are without extensions
  const namesToSourcesToFunctionMeta = new Map<string, Map<string, KeyedFunction>>()
  // filenames (without extension) of files that have a `default` keyed function export
  const defaultExportSources = new Set<string>()

  for (const f of options.keyedFunctions) {
    let functionName = f.name
    const fnSource = typeof f.source === 'string' ? stripExtension(f.source) : ''

    if (f.name === 'default') {
      // TODO: remove this check & warning when `source` is required
      if (!f.source) {
        if (import.meta.dev) {
          logger.warn(`[nuxt:compiler] [keyed-functions] Function with name \`default\` is missing a \`source\`. Skipping it.`)
        }
        continue
      }

      const parsedSource = parse(f.source)
      defaultExportSources.add(parsedSource.name)
      functionName = camelCase(parsedSource.name)
    }

    if (import.meta.dev) {
      const sourcesToFunctionMeta = namesToSourcesToFunctionMeta.get(functionName)
      const existingEntry = sourcesToFunctionMeta?.get(fnSource)
      if (existingEntry?.source && existingEntry.source === fnSource) {
        logger.warn(`[nuxt:compiler] [keyed-functions] Duplicate function name \`${functionName}\`${functionName !== f.name ? ` defined as \`${f.name}\`` : ''} with ${f.source ? `the same source \`${f.source}\`` : 'no source'} found. Overwriting the existing entry.`)
      }
    }

    let sourcesToFunctionMeta = namesToSourcesToFunctionMeta.get(functionName)
    if (!sourcesToFunctionMeta) {
      sourcesToFunctionMeta = new Map<string, KeyedFunction>()
      namesToSourcesToFunctionMeta.set(functionName, sourcesToFunctionMeta)
    }

    sourcesToFunctionMeta.set(fnSource, {
      ...f,
      // TODO: make `source` required
      source: fnSource,
    })
  }

  // resolved paths of all the sources WITHOUT EXTENSIONS
  const sources = new Set<string>()
  for (const sourcesToFunctionMeta of namesToSourcesToFunctionMeta.values()) {
    for (const f of sourcesToFunctionMeta.values()) {
      // TODO: remove check when `source` is required
      if (f.source && typeof f.source === 'string') {
        sources.add(f.source)
      }
    }
  }

  // TODO: come up with a better way to include files importing a `default` export (imported name can be arbitrary)
  const CODE_INCLUDE_RE = new RegExp(`\\b(${[...namesToSourcesToFunctionMeta.keys(), ...defaultExportSources].map(f => escapeRE(f)).join('|')})\\b`)

  return {
    name: 'nuxt:compiler:keyed-functions',
    enforce: 'post',
    transformInclude: id => shouldTransformFile(id, SUPPORTED_EXT_RE),
    transform: {
      filter: {
        code: { include: CODE_INCLUDE_RE },
      },
      handler (code, _id) {
        const { 0: script = code, index: codeIndex = 0 } = code.match(SCRIPT_RE) || { 0: code, index: 0 }
        const id = stripExtension(_id)

        const { directImports, namespaces } = processImports(findStaticImports(script).map(i => parseStaticImport(i)))

        // consider exports when processing a file that exports a keyed function
        const shouldConsiderExports = sources.has(id)

        // all local names that refer to a keyed function
        // mapped to their exported names
        const localNamesToExportedName = new Map<string, string>()

        const possibleLocalFunctionNames = new Set<string>(namesToSourcesToFunctionMeta.keys())
        for (const [localName, directImport] of directImports) {
          // add import names that refer to keyed functions
          const functionName = directImport.originalName === 'default'
            ? camelCase(parse(directImport.source).name)
            : directImport.originalName
          if (namesToSourcesToFunctionMeta.has(functionName)) {
            possibleLocalFunctionNames.add(localName)
          }
        }

        /**
         * @param localName the local name of the function to get the meta for
         * @param source the source of the function to get the meta for (needs to be WITHOUT EXTENSION)
         */
        function getFunctionMetaByLocalName (localName: string, source: string): KeyedFunction | undefined {
          if (!localName) { return }
          // check exports (higher priority)
          const exportedName = localNamesToExportedName.get(localName)
          if (exportedName) {
            return namesToSourcesToFunctionMeta.get(exportedName)?.get(source)
          }
          // check static direct imports
          const directImport = directImports.get(localName)
          if (directImport) {
            const functionName = directImport.originalName === 'default'
              ? camelCase(parse(directImport.source).name)
              : directImport.originalName
            return namesToSourcesToFunctionMeta.get(functionName)?.get(source)
          }

          // check local names
          return namesToSourcesToFunctionMeta.get(localName)?.get(source)
        }

        // TODO: use async walker or create sync version of `resolvePath` from kit
        function _resolvePath (path: string) {
          let p = path
          if (isAbsolute(p)) { return p }
          p = resolveAlias(p, options.alias)
          if (isAbsolute(p)) { return p }
          return join(parse(id).dir, p)
        }

        const s = new MagicString(code)
        let count = 0

        const scopeTracker = new ScopeTracker({
          preserveExitedScopes: true,
        })

        // pre-pass to collect hoisted identifiers & exports
        const { program } = parseAndWalk(code, id, {
          scopeTracker,
          enter (node) {
            if (!shouldConsiderExports) { return }
            if (node.type !== 'ExportNamedDeclaration' && node.type !== 'ExportDefaultDeclaration') { return }

            const result = parseStaticExportIdentifiers(node)
            for (const exportMeta of result) {
              const { localName, exportedName } = exportMeta
              // the function cannot look up function meta by local names yet,
              // so we need to use the `exportedName` instead because that is the one
              // that's used in the keyed functions definition
              const functionName = exportedName === 'default'
                ? camelCase(parse(id).name)
                : getFunctionMetaByLocalName(exportedName, id)?.name
              if (!functionName) { continue }
              localNamesToExportedName.set(localName, functionName)
            }
          },
        })

        scopeTracker.freeze()

        // add exported local identifiers that refer to keyed functions
        for (const localName of localNamesToExportedName.keys()) {
          possibleLocalFunctionNames.add(localName)
        }

        const LOCAL_FUNCTION_NAMES_RE = new RegExp(`\\b(${[...possibleLocalFunctionNames].map(f => escapeRE(f)).join('|')})\\b`)

        function processKeyedFunction (
          walkContext: ThisParameterType<NonNullable<Parameters<typeof walk>[1]['enter']>>, // TODO: export type from `oxc-walker`
          node: Node,
          handler: (ctx: { parsedCall: FunctionCallMetadata, fnMeta: KeyedFunction }) => void,
        ) {
          if (node.type !== 'CallExpression' && node.type !== 'ChainExpression') { return }
          const parsedCall = parseStaticFunctionCall(node, LOCAL_FUNCTION_NAMES_RE)
          if (!parsedCall) { return }

          const functionScopeTrackerNode = scopeTracker.getDeclaration(!parsedCall.namespace ? parsedCall.name : parsedCall.namespace)

          function isKeyedFunctionImport (node: ScopeTrackerNode | null): node is ScopeTrackerNode & { type: 'Import' } {
            return node?.type === 'Import' && node.importNode.importKind !== 'type'
          }

          let importSourceResolved: string | undefined

          // check for exports with a higher priority
          if (localNamesToExportedName.has(parsedCall.name) && functionScopeTrackerNode?.scope === '') { // TODO: add support for checking root scope in `oxc-walker`
            importSourceResolved = id
          } else if (isKeyedFunctionImport(functionScopeTrackerNode)) {
            importSourceResolved = stripExtension(_resolvePath(functionScopeTrackerNode.importNode.source.value))
          }

          if (!importSourceResolved) {
            walkContext.skip()
            return
          }

          const fnMeta = getFunctionMetaByLocalName(parsedCall.name, importSourceResolved)

          if (!fnMeta) {
            walkContext.skip()
            return
          }

          // the function is called directly
          // `useKeyed()`
          if (!parsedCall.namespace) {
            // skip if there are more arguments than allowed
            if (
              parsedCall.callExpression.arguments.length >= fnMeta.argumentLength
              // do not skip when there is a spread element (we don't know how many arguments there are)
              && !parsedCall.callExpression.arguments.some(a => a.type === 'SpreadElement')
            ) {
              walkContext.skip()
              return
            }

            if (
              // the function is imported
              (
                isKeyedFunctionImport(functionScopeTrackerNode) && (
                  // import { useKeyed } from '...'
                  (
                    functionScopeTrackerNode.node.type === 'ImportSpecifier'
                    && functionScopeTrackerNode.node.importKind !== 'type'
                  )
                  // import useKeyed from '...'
                  || (
                    functionScopeTrackerNode.node.type === 'ImportDefaultSpecifier'
                    && fnMeta.name === 'default'
                  )
                )
                // TODO: remove `!fnMeta.source` check when `source` is required
                // TODO: make it work for functions without `source` imported from `#imports`
                // the function is imported from the correct source
                && (fnMeta.source && stripExtension(fnMeta.source) === importSourceResolved)
              )
              // or the function is defined in the current file, and we're considering the root level scope declaration
              || (localNamesToExportedName.has(parsedCall.name) && functionScopeTrackerNode?.scope === '') // TODO: add support for checking root scope in `oxc-walker`
            ) {
              handler({ parsedCall, fnMeta })
            }

            walkContext.skip()
            return
          }

          // the function is called as a member of a namespace import
          // `namespace.useKeyed()`
          if (parsedCall.namespace) {
            const namespacedImportMeta = namespaces.get(importSourceResolved)
            const namespaceScopeTrackerNode = scopeTracker.getDeclaration(parsedCall.namespace)

            if (
              namespacedImportMeta && namespacedImportMeta.namespaces.has(parsedCall.namespace)
              // the namespace is not shadowed
              && namespaceScopeTrackerNode?.type === 'Import' && namespaceScopeTrackerNode.node.type === 'ImportNamespaceSpecifier'
            ) {
              handler({ parsedCall, fnMeta })
            }

            // prevent descending into CallExpression of a ChainExpression
            walkContext.skip()
            return
          }
        }

        walk(program, {
          scopeTracker,
          enter (node) {
            processKeyedFunction(this, node, ({ parsedCall, fnMeta }) => {
              // skip key injection for Nuxt internal composables when they already have a key
              switch (parsedCall.name) {
                case 'useState':
                  if (
                    stringTypes.includes(parsedCall.callExpression.arguments[0]?.type)
                    && fnMeta.source && stripExtension(fnMeta.source) === stripExtension(resolveAlias('#app/composables/state', options.alias))
                  ) { return }
                  break
                case 'useFetch':
                case 'useLazyFetch':
                  if (
                    stringTypes.includes(parsedCall.callExpression.arguments[1]?.type)
                    && fnMeta.source && stripExtension(fnMeta.source) === stripExtension(resolveAlias('#app/composables/fetch', options.alias))
                  ) { return }
                  break

                case 'useAsyncData':
                case 'useLazyAsyncData':
                  if (
                    stringTypes.includes(parsedCall.callExpression.arguments[0]?.type)
                    && fnMeta.source && stripExtension(fnMeta.source) === stripExtension(resolveAlias('#app/composables/asyncData', options.alias))
                  ) { return }
                  break
              }

              // inject a key to the function call
              let i = codeIndex + parsedCall.callExpression.end - 2 // char before the closing `)`
              while (i >= codeIndex + parsedCall.callExpression.start && isWhitespace(code[i])) {
                i--
              }
              const endsWithComma = code[i] === ','

              s.appendLeft(
                codeIndex + parsedCall.callExpression.end - 1,
                (parsedCall.callExpression.arguments.length && !endsWithComma ? ', ' : '') + '\'$' + hash(`${_id}-${++count}`).slice(0, 10) + '\'',
              )
            })
          },
        })

        if (s.hasChanged()) {
          return {
            code: s.toString(),
            map: options.sourcemap
              ? s.generateMap({ hires: true })
              : undefined,
          }
        }
      },
    },
  }
})
