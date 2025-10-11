import { createCompilerScanPlugin, resolveAlias } from '@nuxt/kit'
import escapeRE from 'escape-string-regexp'
import { JS_EXTENSIONS, isJavascriptExtension, logger } from '../../utils'
import type {
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  IdentifierReference,
  MemberExpression,
  ParenthesizedExpression,
  VariableDeclarator,
} from 'oxc-parser'
import { parse } from 'pathe'
import { camelCase } from 'scule'
import { createUnplugin } from 'unplugin'
import { shouldTransformFile } from './keyed-functions'
import MagicString from 'magic-string'
import { ScopeTracker, parseAndWalk, walk } from 'oxc-walker'
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
export function parseKeyedFunctionFactory (node: ExportNamedDeclaration | ExportDefaultDeclaration, filter: RegExp, filePath: string, scopeTracker: ScopeTracker): ParsedKeyedFunctionFactory[] {
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
        functionName: camelCase(parse(filePath).name),
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
 * @param namesToFactoryMeta - map of factory function names to their metadata; it is expected that the `source`s have had their aliases resolved
 * @param imports
 * @param autoImportsToSources
 */
function createFactoryProcessor (
  filePath: string,
  scopeTracker: ScopeTracker,
  namesToFactoryMeta: Map<string, KeyedFunctionFactory>,
  imports: ParsedStaticImport[],
  autoImportsToSources: Map<string, string> | undefined,
) {
  const { directImports, namespaces } = processImports(imports)

  const localFactoryNames = new Set<string>(namesToFactoryMeta.keys())
  for (const [localName, directImport] of directImports) {
    if (namesToFactoryMeta.has(directImport.originalName)) {
      localFactoryNames.add(localName)
    }
  }
  const LOCAL_FACTORY_NAMES_RE = new RegExp(`\\b(${[...localFactoryNames].map(f => escapeRE(f)).join('|')})\\b`)

  function getFactoryByLocalName (localName: string | undefined) {
    if (!localName) { return undefined }
    const directImport = directImports.get(localName)
    if (directImport) {
      return namesToFactoryMeta.get(directImport.originalName)
    }
    return namesToFactoryMeta.get(localName)
  }

  function processFactory (
    node: ExportNamedDeclaration | ExportDefaultDeclaration,
    handler: (ctx: { parseFactoryResult: ParsedKeyedFunctionFactory, factory: KeyedFunctionFactory }) => void,
  ) {
    const parseFactoryResults = parseKeyedFunctionFactory(node, LOCAL_FACTORY_NAMES_RE, filePath, scopeTracker)
    if (!parseFactoryResults.length) {
      return
    }

    for (const parseFactoryResult of parseFactoryResults) {
      const factoryMeta = getFactoryByLocalName(parseFactoryResult.factoryName)
      if (!factoryMeta) {
        logger.error(`[nuxt:compiler] No factory function found for \`${parseFactoryResult.functionName}\` in file \`${filePath}\`. This is a Nuxt bug.`)
        return
      }

      const factoryScopeTrackerNode = scopeTracker.getDeclaration(parseFactoryResult.factoryName)

      // we don't always need to check for auto-imports (in transformed code, all imports have already been added)
      const autoImportedSource = autoImportsToSources?.get(factoryMeta.name)
      const resolvedFactorySource = factoryMeta.source
      const namespacedImportMeta = namespaces.get(resolvedFactorySource)

      // the factory is called directly
      // `createUseFetch()`
      if (!parseFactoryResult.namespace && (
      // and the factory is imported directly
        (factoryScopeTrackerNode?.type === 'Import' && resolveAlias(factoryScopeTrackerNode.importNode.source.value) === resolvedFactorySource)
      // or the factory is auto-imported
      || (!factoryScopeTrackerNode && autoImportedSource && resolveAlias(autoImportedSource) === resolvedFactorySource)
      )
      ) {
        handler({ parseFactoryResult, factory: factoryMeta })
        continue
      }

      // the function is called as a member of a namespace import
      // `namespace.createUseFetch()`
      if (
        parseFactoryResult.namespace && namespacedImportMeta && namespacedImportMeta.namespaces.has(parseFactoryResult.namespace)
      ) {
        handler({ parseFactoryResult, factory: factoryMeta })
        continue
      }

      logger.debug(`[nuxt:compiler] The factory function \`${factoryMeta.name}\` used to create \`${parseFactoryResult.functionName}\` in file \`${filePath}\` is not imported and is not in auto-imports. Skipping processing.`)
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
    source: resolveAlias(f.source),
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
      const { processFactory } = createFactoryProcessor(id, scopeTracker, namesToFactoryMeta, this.getParsedStaticImports(), autoImportsToSources)

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

          processFactory(node, ({ parseFactoryResult, factory }) => {
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
    source: resolveAlias(f.source),
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
            processFactory(node, ({ parseFactoryResult }) => {
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
