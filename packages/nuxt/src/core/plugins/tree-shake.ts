import { stripLiteral } from 'strip-literal'
import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'
import { isJS, isVue } from '../utils'

type ImportPath = string

interface TreeShakeComposablesPluginOptions {
  sourcemap?: boolean
  composables: Record<ImportPath, string[]>
}

export const TreeShakeComposablesPlugin = (options: TreeShakeComposablesPluginOptions) => createUnplugin(() => {
  /**
   * @todo Use the options import-path to tree-shake composables in a safer way.
   */
  const composableNames = Object.values(options.composables).flat()

  const regexp = `(^\\s*)(${composableNames.join('|')})(?=\\((?!\\) \\{))`
  const COMPOSABLE_RE = new RegExp(regexp, 'm')
  const COMPOSABLE_RE_GLOBAL = new RegExp(regexp, 'gm')

  return {
    name: 'nuxt:tree-shake-composables:transform',
    enforce: 'post',
    transformInclude (id) {
      return isVue(id, { type: ['script'] }) || isJS(id)
    },
    transform: {
      filter: {
        code: { include: COMPOSABLE_RE },
      },
      handler (code) {
        const s = new MagicString(code)

        // Parse and collect scope information
        const scopeTracker = new ScopeTracker({ preserveExitedScopes: true })
        const parseResult = parseAndWalk(code, id, {
          scopeTracker,
        })
        scopeTracker.freeze()

        // Process nodes and check for tree-shaking opportunities
        walk(parseResult.program, {
          scopeTracker,
          enter (node) {
            if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') {
              return
            }

            const functionName = node.callee.name
            const scopeTrackerNode = scopeTracker.getDeclaration(functionName)

            if (scopeTrackerNode) {
            // don't tree-shake if there's a local declaration
              if (scopeTrackerNode.type !== 'Import') {
                return
              }

              if (scopeTrackerNode.importNode.type !== 'ImportDeclaration') {
                return
              }

              // check if import is from an allowed source and composable
              const importPath = scopeTrackerNode.importNode.source.value

              const importSpecifier = scopeTrackerNode.node
              const importedName = importSpecifier.type === 'ImportSpecifier' && importSpecifier.imported.type === 'Identifier'
                ? importSpecifier.imported.name
                : importSpecifier.local.name

              const isFromAllowedPath = importPath === '#imports'
                ? allComposableNames.has(importedName)
                : options.composables[importPath]?.includes(importedName)

              if (!isFromAllowedPath) {
                return
              }
            }

            if (!scopeTrackerNode && !allComposableNames.has(functionName)) {
              return
            }

            // TODO: validate function name against actual auto-imports registry
            s.overwrite(node.start, node.end, ` false && /*@__PURE__*/ ${functionName}${code.slice(node.callee.end, node.end)}`)
            this.skip()
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
