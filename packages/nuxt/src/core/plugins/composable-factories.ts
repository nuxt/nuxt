import { createUnplugin } from 'unplugin'
import escapeRE from 'escape-string-regexp'
import MagicString from 'magic-string'
import { parseAndWalk } from 'oxc-walker'
import type { CallExpression, ExportDefaultDeclaration, IdentifierReference, Node } from 'oxc-parser'
import { shouldTransformFile } from './composable-keys'

/**
 * Check if the node is a named export of a composable factory and if so,
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

interface ComposableFactory {
  name: string
  path: string
}

interface ComposableFactoriesOptions {
  sourcemap: boolean
  factories: {
    /**
     * The publicly available function that serves as a placeholder for the actual composable factory.
     */
    macro: ComposableFactory
    /**
     * The actual composable factory function that creates the desired composable.
     * This function will replace the public function in the final build.
     */
    replacement: ComposableFactory
  }[]
}

export const SUPPORTED_EXTENSIONS = ['ts', 'js'] as const

export const ComposableFactoriesPlugin = (options: ComposableFactoriesOptions) => createUnplugin(() => {
  const COMPOSABLE_FACTORIES_RE = new RegExp(`\\b(${options.factories.map(f => escapeRE(f.macro.name)).join('|')})\\b`)

  const macroNames = new Set(options.factories.map(f => f.macro.name))
  const macroReplacements = new Map(options.factories.map(f => [f.macro.name, {
    replacement: f.replacement.name,
    macroPath: f.macro.path,
  }]))

  return {
    name: 'nuxt:composable-factories',
    enforce: 'pre',
    transformInclude: id => shouldTransformFile(id, SUPPORTED_EXTENSIONS),
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
