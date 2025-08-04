import { addBuildPlugin, createCompilerScanPlugin } from '@nuxt/kit'
import type { KeyedComposable } from '@nuxt/schema'
import escapeRE from 'escape-string-regexp'
import { JS_EXTENSIONS, isJavascriptExtension, logger } from '../../utils.ts'
import type { CallExpression, ExportDefaultDeclaration, IdentifierReference, Node } from 'oxc-parser'
import { parse } from 'pathe'
import { camelCase } from 'scule'
import { createUnplugin } from 'unplugin'
import { shouldTransformFile } from '../../core/plugins/composable-keys.ts'
import MagicString from 'magic-string'
import { parseAndWalk } from 'oxc-walker'

// -------- compiler scan plugin for scanning keyed composable factories --------

/**
 * Scans files for factory functions that need auto-injected keys.
 */
export const KeyedFactoriesScanPlugin = createCompilerScanPlugin(() => {
  const keyedFactories: KeyedComposable[] = []

  // TODO: add a way to create factories automatically via @nuxt/kit
  const composableFactoryNames = new Set(['createUseFetch', 'createUseAsyncData'])
  const COMPOSABLE_FACTORY_NAMES_RE = new RegExp(`\\b(${[...composableFactoryNames].map(f => escapeRE(f)).join('|')})\\s*\\(\\s*`)

  return {
    name: 'nuxt:keyed-factories',
    filter: {
      id: id => isJavascriptExtension(id),
      code: { include: COMPOSABLE_FACTORY_NAMES_RE },
    },
    scan ({ id: filePath, nuxt }) {
      function getKeyedComposableEntry (factoryName: string) {
        const composableName = camelCase(factoryName.replace(/^create/, ''))
        return nuxt.options.optimization.keyedComposables.find(c => c.name === composableName)
      }

      this.walkParsed({
        enter (node) {
          // TODO: (perf) walk only the root lexical scope and skip subtrees when https://github.com/oxc-project/oxc-walker/issues/106 is implemented

          let keyedComposableEntry: ReturnType<typeof getKeyedComposableEntry>
          let composableName: string
          let factoryName: string

          const namedExport = getComposableFactoryNamedExport(node, composableFactoryNames)

          if (namedExport) {
            // handle a named export of a composable factory
            factoryName = ((namedExport.init as CallExpression).callee as IdentifierReference).name
            keyedComposableEntry = getKeyedComposableEntry(factoryName)
            composableName = (namedExport.id as IdentifierReference).name
          } else if (isComposableFactoryDefaultExport(node, composableFactoryNames)) {
            // handle default export of a composable factory
            factoryName = ((node.declaration as CallExpression).callee as IdentifierReference).name
            keyedComposableEntry = getKeyedComposableEntry(factoryName)

            const parsedFilePath = parse(filePath)
            composableName = camelCase(parsedFilePath.name)
          } else {
            // skip irrelevant nodes
            return
          }

          if (!keyedComposableEntry) {
            // if this happens, it is a Nuxt bug, since we currently don't allow users to create their own composable factories
            logger.error(`No keyed composable entry found for \`${composableName}\` (from factory \`${factoryName}\` in file \`${filePath}\`). This is a Nuxt bug.`)
            return
          }

          keyedFactories.push({
            name: composableName,
            source: filePath,
            argumentLength: keyedComposableEntry.argumentLength,
          })
        },
      })
    },
    afterScan: (nuxt) => {
      nuxt.options.optimization.keyedComposables.push(...keyedFactories)

      // replace composable factory compiler macros with actual factories
      addBuildPlugin(KeyedFactoriesPlugin({
        sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
        factories: [
          {
            macro: {
              name: 'createUseFetch',
              path: '#app/composables/fetch',
            },
            replacement: {
              name: '_createUseFetch',
              path: '#app/composables/fetch',
            },
          },
        ],
      }))
    },
  }
})

// -------- unplugin for replacing keyed factory macros --------

/**
 * Check if the node is a named export of a composable factory, and if so,
 * return its VariableDeclarator node.
 */
export function getComposableFactoryNamedExport (node: Node, factoryNames: Set<string>) {
  return (
    node.type === 'ExportNamedDeclaration'
    && node.declaration?.type === 'VariableDeclaration'
    && node.declaration.declarations.find(d =>
      d.init?.type === 'CallExpression'
      && d.init.callee.type === 'Identifier' && factoryNames.has(d.init.callee.name),
    )
  ) || undefined
}

/**
 * Check if the node is a default export of a composable factory.
 */
export function isComposableFactoryDefaultExport (node: Node, factoryNames: Set<string>): node is ExportDefaultDeclaration {
  return node.type === 'ExportDefaultDeclaration'
    && node.declaration.type === 'CallExpression'
    && node.declaration.callee.type === 'Identifier' && factoryNames.has(node.declaration.callee.name)
}

// TODO: add a way to create factories automatically via @nuxt/kit
interface KeyedFactory {
  name: string
  path: string
}

interface KeyedFactoriesOptions {
  sourcemap: boolean
  factories: {
    /**
     * The publicly available function that serves as a placeholder for the actual composable factory.
     */
    macro: KeyedFactory
    /**
     * The actual composable factory function that creates the desired composable.
     * This function will replace the public function in the final build.
     */
    replacement: KeyedFactory
  }[]
}

export const KeyedFactoriesPlugin = (options: KeyedFactoriesOptions) => createUnplugin(() => {
  const COMPOSABLE_FACTORIES_RE = new RegExp(`\\b(${options.factories.map(f => escapeRE(f.macro.name)).join('|')})\\b`)

  const macroNames = new Set(options.factories.map(f => f.macro.name))
  const macroReplacements = new Map(options.factories.map(f => [f.macro.name, {
    replacement: f.replacement.name,
    macroPath: f.macro.path,
  }]))

  return {
    name: 'nuxt:keyed-factories',
    enforce: 'pre',
    transformInclude: id => shouldTransformFile(id, JS_EXTENSIONS),
    transform: {
      filter: {
        code: { include: COMPOSABLE_FACTORIES_RE },
      },
      handler (code, id) {
        const s = new MagicString(code)

        // TODO: handle path checking

        const importedReplacements = new Set<string>()
        const factoryImports: string[] = []

        parseAndWalk(code, id, {
          enter (node) {
            // TODO: (perf) walk only the root lexical scope and skip subtrees when https://github.com/oxc-project/oxc-walker/issues/106 is implemented

            const namedExportDeclarator = getComposableFactoryNamedExport(node, macroNames)

            let callee: IdentifierReference
            let macroReplacementEntry: ReturnType<typeof macroReplacements.get>

            if (namedExportDeclarator) {
              callee = (namedExportDeclarator.init as CallExpression).callee as IdentifierReference

              macroReplacementEntry = macroReplacements.get(callee.name)
            } else if (isComposableFactoryDefaultExport(node, macroNames)) {
              callee = (node.declaration as CallExpression).callee as IdentifierReference

              macroReplacementEntry = macroReplacements.get(callee.name)
            } else {
              // skip irrelevant nodes
              return
            }

            if (!macroReplacementEntry) {
              throw new Error(`[nuxt] [ComposableFactoriesPlugin] Could not find metadata for composable factory macro \`${callee.name}\`. This is a Nuxt bug.`)
            }

            if (!importedReplacements.has(macroReplacementEntry.replacement)) {
              importedReplacements.add(macroReplacementEntry.replacement)
              factoryImports.push(`import { ${macroReplacementEntry.replacement} } from '${macroReplacementEntry.macroPath}'`)
            }

            s.overwrite(
              callee.start,
              callee.end,
              macroReplacementEntry.replacement,
            )
          },
        })

        if (factoryImports.length) {
          s.prepend(factoryImports.join('\n') + '\n')
        }

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
