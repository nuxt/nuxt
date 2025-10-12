import { createCompilerScanPlugin, resolveAlias } from '@nuxt/kit'
import escapeRE from 'escape-string-regexp'
import { JS_EXTENSIONS, isJavascriptExtension, logger, stripExtension } from '../../utils'
import type {
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  IdentifierReference,
  MemberExpression,
  ParenthesizedExpression,
  VariableDeclarator,
} from 'oxc-parser'
import { isAbsolute, join, parse } from 'pathe'
import { createUnplugin } from 'unplugin'
import { shouldTransformFile } from './keyed-functions'
import MagicString from 'magic-string'
import { ScopeTracker, type ScopeTrackerNode, parseAndWalk, walk } from 'oxc-walker'
import { type ParsedStaticImport, findStaticImports, parseStaticImport } from 'mlly'
import type { KeyedFunction, KeyedFunctionFactory } from '@nuxt/schema'
import { type FunctionCallMetadata, parseStaticFunctionCall, processImports } from '../parse-utils'

interface ParsedKeyedFunctionFactory {
  factoryName: string
  factoryNode: FunctionCallMetadata['node']
  functionName: string
  namespace: string | null
}

/**
 * Check if the node is a named export of a keyed function factory, and if so,
 * return its VariableDeclarator node.
 */
export function parseKeyedFunctionFactory (node: ExportNamedDeclaration | ExportDefaultDeclaration, filter: RegExp, scopeTracker: ScopeTracker): ParsedKeyedFunctionFactory[] {
  if (node.type === 'ExportNamedDeclaration') {
    const parsed: ParsedKeyedFunctionFactory[] = []

    function processVariableDeclarator (node: VariableDeclarator) {
      if (node.init?.type !== 'CallExpression' && node.init?.type !== 'ChainExpression') { return }
      const functionCallMeta = parseStaticFunctionCall(node.init, filter)
      if (functionCallMeta && node?.id.type === 'Identifier') {
        parsed.push({
          factoryName: functionCallMeta.name,
          factoryNode: functionCallMeta.node,
          functionName: node.id.name,
          namespace: functionCallMeta.namespace,
        })
      }
    }

    // export const useFetch = createUseFetch()
    if (node.declaration?.type === 'VariableDeclaration') {
      for (const d of node.declaration.declarations) {
        processVariableDeclarator(d)
      }
    // export { useFetch }
    } else if (node.specifiers.length) {
      for (const specifier of node.specifiers) {
        if (specifier.type !== 'ExportSpecifier' || specifier.exported.type !== 'Identifier' || specifier.local.type !== 'Identifier') { continue }
        const declaration = scopeTracker.getDeclaration(specifier.local.name)
        if (declaration?.type !== 'Variable') { continue }

        for (const d of declaration.variableNode.declarations) {
          processVariableDeclarator(d)
        }
      }
    }

    return parsed
  }

  if (node.type === 'ExportDefaultDeclaration' && node.declaration.type === 'CallExpression') {
    const functionCallMeta = parseStaticFunctionCall(node.declaration, filter)
    if (functionCallMeta) {
      return [{
        factoryName: functionCallMeta.name,
        factoryNode: functionCallMeta.node,
        functionName: 'default',
        namespace: functionCallMeta.namespace,
      }]
    }
    return []
  }

  return []
}

/**
 * @param filePath
 * @param scopeTracker
 * @param namesToFactoryMeta - map of factory function names to their metadata; it is expected that the `source`s have had their aliases resolved and are without extensions
 * @param imports
 * @param autoImportsToSources
 * @param alias
 */
function createFactoryProcessor (
  filePath: string,
  scopeTracker: ScopeTracker,
  namesToFactoryMeta: Map<string, KeyedFunctionFactory>,
  imports: ParsedStaticImport[],
  autoImportsToSources: Map<string, string> | undefined,
  alias: Record<string, string>,
) {
  const { directImports, namespaces } = processImports(imports, alias)

  const localFactoryNames = new Set<string>(namesToFactoryMeta.keys())
  for (const [localName, directImport] of directImports) {
    if (namesToFactoryMeta.has(directImport.originalName)) {
      localFactoryNames.add(localName)
    }
  }
  const LOCAL_FACTORY_NAMES_RE = new RegExp(`\\b(${[...localFactoryNames].map(f => escapeRE(f)).join('|')})\\b`)

  // TODO: use async walker or create sync version of `resolvePath` from kit
  function _resolvePath (path: string) {
    let p = path
    if (isAbsolute(p)) { return p }
    p = resolveAlias(p, alias)
    if (isAbsolute(p)) { return p }
    return join(parse(filePath).dir, p)
  }

  function getFactoryByLocalName (localName: string | undefined) {
    if (!localName) { return undefined }
    const directImport = directImports.get(localName)
    if (directImport) {
      return namesToFactoryMeta.get(directImport.originalName)
    }
    return namesToFactoryMeta.get(localName)
  }

  function processFactory (
    walkContext: ThisParameterType<NonNullable<Parameters<typeof walk>[1]['enter']>>, // TODO: export type from `oxc-walker`
    node: ExportNamedDeclaration | ExportDefaultDeclaration,
    handler: (ctx: { parseFactoryResult: ParsedKeyedFunctionFactory, factory: KeyedFunctionFactory }) => void,
  ) {
    const parsedFactoryCalls = parseKeyedFunctionFactory(node, LOCAL_FACTORY_NAMES_RE, scopeTracker)
    if (!parsedFactoryCalls.length) { return }

    for (const parsedFactoryCall of parsedFactoryCalls) {
      const factoryMeta = getFactoryByLocalName(parsedFactoryCall.factoryName)
      if (!factoryMeta) {
        logger.error(`[nuxt:compiler] No factory function found for \`${parsedFactoryCall.functionName}\` in file \`${filePath}\`. This is a Nuxt bug.`)
        return
      }

      const scopeTrackerNode = scopeTracker.getDeclaration(!parsedFactoryCall.namespace ? parsedFactoryCall.factoryName : parsedFactoryCall.namespace)

      function isFactoryImport (node: ScopeTrackerNode | null): node is ScopeTrackerNode & { type: 'Import' } {
        return node?.type === 'Import' && node.importNode.importKind !== 'type'
      }

      // import source WITHOUT EXTENSION and with resolved alias
      let importSourceResolved: string | undefined

      if (isFactoryImport(scopeTrackerNode)) {
        importSourceResolved = stripExtension(_resolvePath(scopeTrackerNode.importNode.source.value))
      } else if (!scopeTrackerNode) {
        const autoImportedSource = autoImportsToSources?.get(factoryMeta.name)
        if (autoImportedSource) {
          importSourceResolved = stripExtension(_resolvePath(autoImportedSource))
        }
      }

      if (!importSourceResolved) {
        continue
      }

      // resolved source WITHOUT an extension
      const resolvedFactorySource = factoryMeta.source

      // the factory is called directly
      // `createUseFetch()`
      if (
        !parsedFactoryCall.namespace && (
          // and the factory is imported directly
          (
            isFactoryImport(scopeTrackerNode) && (
              (
                // import { createUseFetch } from '...'
                scopeTrackerNode.node.type === 'ImportSpecifier'
                && scopeTrackerNode.node.importKind !== 'type'
              )
              // import createUseFetch from '...'
              || (
                scopeTrackerNode.node.type === 'ImportDefaultSpecifier'
                && factoryMeta.name === 'default'
              )
            )
            // from the correct source
            && importSourceResolved === resolvedFactorySource
          )
          // or the factory is auto-imported
          || (!scopeTrackerNode && importSourceResolved === resolvedFactorySource)
          // we deliberately do not support scanning for factories used in the same file they are defined in
        )
      ) {
        handler({ parseFactoryResult: parsedFactoryCall, factory: factoryMeta })
        walkContext.skip()
        continue
      }

      // the function is called as a member of a namespace import
      // `namespace.createUseFetch()`
      if (parsedFactoryCall.namespace) {
        const namespacedImportMeta = namespaces.get(resolvedFactorySource)
        const namespaceScopeTrackerNode = scopeTracker.getDeclaration(parsedFactoryCall.namespace)

        if (namespacedImportMeta && namespacedImportMeta.namespaces.has(parsedFactoryCall.namespace)
          // the namespace is not shadowed
          && namespaceScopeTrackerNode?.type === 'Import' && namespaceScopeTrackerNode.node.type === 'ImportNamespaceSpecifier'
        ) {
          handler({ parseFactoryResult: parsedFactoryCall, factory: factoryMeta })
        }

        // prevent descending into CallExpression of a ChainExpression
        walkContext.skip()
        continue
      }

      logger.debug(`[nuxt:compiler] The factory function \`${factoryMeta.name}\` used to create \`${parsedFactoryCall.functionName}\` in file \`${filePath}\` is not imported and is not in auto-imports. Skipping processing.`)
    }
  }

  return {
    processFactory,
  }
}

// -------- compiler scan plugin for scanning keyed function factories --------

interface KeyedFunctionFactoriesScanPluginOptions {
  /**
   * The factory functions that create keyed functions.
   * Aliases in `source` have not been resolved yet.
   */
  factories: KeyedFunctionFactory[]
  alias: Record<string, string>
}

/**
 * Scans raw source files for factory functions that need auto-injected keys
 * so that it can register them for key injection.
 */
export const KeyedFunctionFactoriesScanPlugin = (options: KeyedFunctionFactoriesScanPluginOptions) => createCompilerScanPlugin(() => {
  const keyedFunctionsCreatedByFactories: KeyedFunction[] = []

  // DO NOT USE IN SCAN - this is a global copy that doesn't include local import renames
  // - the `source`s have resolved aliases
  const namesToFactoryMeta = new Map<string, KeyedFunctionFactory>(options.factories.map(f => [f.name, {
    ...f,
    source: stripExtension(resolveAlias(f.source, options.alias)),
  }]))

  // TODO: support default import, which won't have the factory name
  const KEYED_FUNCTION_FACTORY_NAMES_RE = new RegExp(`\\b(${options.factories.map(f => escapeRE(f.name)).join('|')})\\b`)

  return {
    name: 'nuxt:keyed-function-factories',
    filter: {
      id: id => isJavascriptExtension(id),
      code: { include: KEYED_FUNCTION_FACTORY_NAMES_RE },
    },
    scan ({ id, autoImportsToSources }) {
      const scopeTracker = new ScopeTracker({
        preserveExitedScopes: true,
      })
      const { processFactory } = createFactoryProcessor(id, scopeTracker, namesToFactoryMeta, this.getParsedStaticImports(), autoImportsToSources, options.alias)

      this.walkParsed({
        scopeTracker,
      })

      scopeTracker.freeze()

      let isWalkingSupportedSubtree = false

      this.walkParsed({
        // no need for a scope tracker pre-pass, since we only care about imports
        // and we only consider the root scope (because that's where an export would be - so no shadowing)
        scopeTracker,
        enter (node) {
          // (perf) skip walking subtrees that can't contain what we're looking for
          if (node.type !== 'Program' && !isWalkingSupportedSubtree && node.type !== 'ExportNamedDeclaration' && node.type !== 'ExportDefaultDeclaration' && node.type !== 'ImportDeclaration') {
            this.skip()
          }
          if (node.type !== 'ExportNamedDeclaration' && node.type !== 'ExportDefaultDeclaration') {
            return
          }
          isWalkingSupportedSubtree = true

          processFactory(this, node, ({ parseFactoryResult, factory }) => {
            keyedFunctionsCreatedByFactories.push({
              name: parseFactoryResult.functionName,
              source: id,
              argumentLength: factory.argumentLength,
            })
          })
        },
        leave (node) {
          if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration' || node.type === 'ImportDeclaration') {
            isWalkingSupportedSubtree = false
          }
        },
      })
    },
    afterScan: (nuxt) => {
      nuxt.options.optimization.keyedComposables.push(...keyedFunctionsCreatedByFactories)
    },
  }
})

// -------- unplugin for replacing keyed factory macros --------

interface KeyedFunctionFactoriesPluginOptions {
  sourcemap: boolean
  factories: KeyedFunctionFactory[]
  alias: Record<string, string>
}

/**
 * A plugin that replaces placeholder macros with actual factory functions.
 * This is necessary to ensure that the user is notified when the factory function isn't correctly
 * registered - in which case, the resulting function created by the factory will not be registered for key injection.
 *
 * The plugin assumes that the code being processed has all imports added.
 */
export const KeyedFunctionFactoriesPlugin = (options: KeyedFunctionFactoriesPluginOptions) => createUnplugin(() => {
  // DO NOT USE IN TRANSFORM - this is a global copy that doesn't include local import renames
  // - the `source`s have resolved aliases
  const namesToFactoryMeta = new Map<string, KeyedFunctionFactory>(options.factories.map(f => [f.name, {
    ...f,
    source: stripExtension(resolveAlias(f.source, options.alias)),
  }]))

  // TODO: support default import, which won't have the factory name
  const KEYED_FUNCTION_FACTORY_NAMES_RE = new RegExp(`\\b(${options.factories.map(f => escapeRE(f.name)).join('|')})\\b`)

  return {
    name: 'nuxt:compiler:keyed-function-factories',
    enforce: 'post',
    transformInclude: id => shouldTransformFile(id, JS_EXTENSIONS),
    transform: {
      filter: {
        code: { include: KEYED_FUNCTION_FACTORY_NAMES_RE },
      },
      handler (code, id) {
        const s = new MagicString(code)
        const scopeTracker = new ScopeTracker({
          preserveExitedScopes: true,
        })
        const { processFactory } = createFactoryProcessor(
          id,
          scopeTracker,
          namesToFactoryMeta,
          findStaticImports(code).map(i => parseStaticImport(i)),
          undefined, // TODO: add auto-imports
          options.alias,
        )

        function rewriteFactoryMacro (node: IdentifierReference | MemberExpression | ParenthesizedExpression) {
          // TODO: use sth more robust for rewriting optionals
          if (node.type === 'Identifier') {
            // createUseFetch?.() -> createUseFetch?.__nuxt_factory()
            if (code[node.end] === '?' && code[node.end + 1] === '.') {
              s.overwrite(
                node.start,
                node.end + 2,
                `${node.name}?.__nuxt_factory`,
              )
            } else {
              // createUseFetch() -> createUseFetch.__nuxt_factory()
              s.overwrite(
                node.start,
                node.end,
                `${node.name}.__nuxt_factory`,
              )
            }
          } else if (code[node.end] === '?' && code[node.end + 1] === '.') {
            // ['createUseFetch']?.() -> ['createUseFetch']?.__nuxt_factory()
            s.appendLeft(node.end + 2, '__nuxt_factory')
          } else {
            // ['createUseFetch']() -> ['createUseFetch'].__nuxt_factory()
            s.appendLeft(node.end, '.__nuxt_factory')
          }
        }

        const { program } = parseAndWalk(code, id, {
          scopeTracker,
        })

        scopeTracker.freeze()

        walk(program, {
          // no need for a scope tracker pre-pass, since we only care about imports
          // and we only consider the root scope (because that's where an export would be - so no shadowing)
          scopeTracker,
          enter (node) {
            if (node.type !== 'ExportNamedDeclaration' && node.type !== 'ExportDefaultDeclaration') {
              return
            }
            processFactory(this, node, ({ parseFactoryResult }) => {
              rewriteFactoryMacro(parseFactoryResult.factoryNode)
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
