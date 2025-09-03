import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'
import { parseAndWalk } from 'oxc-walker'
import type { ImportDeclaration } from 'oxc-parser'

import { isJS, isVue } from '../utils'

type ImportPath = string

interface TreeShakeComposablesPluginOptions {
  sourcemap?: boolean
  composables: Record<ImportPath, string[]>
}

export const TreeShakeComposablesPlugin = (options: TreeShakeComposablesPluginOptions) => createUnplugin(() => {
  // Create a fast lookup for all composable names
  const allComposableNames = new Set(Object.values(options.composables).flat())

  return {
    name: 'nuxt:tree-shake-composables:transform',
    enforce: 'post',
    transformInclude (id) {
      return isVue(id, { type: ['script'] }) || isJS(id)
    },
    transform: {
      filter: {
        code: { include: new RegExp(`\\b(${[...allComposableNames].join('|')})\\s*\\(`) },
      },
      handler (code, id) {
        const s = new MagicString(code)

        // Track imports to know which composables are imported from which paths
        const importedComposables = new Map<string, string>() // composableName -> importPath
        const allImportedComposableNames = new Set<string>() // Track all imports of composable names

        parseAndWalk(code, id, (node) => {
          // Track import declarations
          if (node.type === 'ImportDeclaration') {
            const importDecl = node as ImportDeclaration
            if (importDecl.source.type !== 'Literal' || !importDecl.specifiers) {
              return
            }

            const importPath = importDecl.source.value

            for (const specifier of importDecl.specifiers) {
              if (specifier.type !== 'ImportSpecifier' || specifier.imported.type !== 'Identifier') {
                continue
              }

              const importedName = specifier.imported.name
              const localName = specifier.local.name

              // Track all imports of composable names, regardless of path
              if (allComposableNames.has(importedName)) {
                allImportedComposableNames.add(localName)

                // Only track the path if it's from an allowed source
                if (importPath === '#imports' || options.composables[importPath]?.includes(importedName)) {
                  importedComposables.set(localName, importPath)
                }
              }
            }
            return
          }

          // Look for function call expressions
          if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') {
            return
          }

          const functionName = node.callee.name

          // Check if this is a composable we should tree-shake
          if (!allComposableNames.has(functionName) && !importedComposables.has(functionName)) {
            return
          }

          // If it's explicitly imported from an allowed path, tree-shake it
          if (importedComposables.has(functionName)) {
            s.overwrite(node.start, node.end, ` false && /*@__PURE__*/ ${functionName}${code.slice(node.callee.end, node.end)}`)
            return
          }

          // If it's not explicitly imported at all, assume it's auto-imported and tree-shake it
          if (!allImportedComposableNames.has(functionName)) {
            s.overwrite(node.start, node.end, ` false && /*@__PURE__*/ ${functionName}${code.slice(node.callee.end, node.end)}`)
          }
        })

        if (s.hasChanged()) {
          return {
            code: s.toString(),
            map: options.sourcemap ? s.generateMap({ hires: true }) : undefined,
          }
        }
      },
    },
  }
})
