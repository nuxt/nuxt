import { generateTransform, rolldownString } from 'rolldown-string'
import { createUnplugin } from 'unplugin'
import { ScopeTracker, parseAndWalk, walk } from 'oxc-walker'
import escapeStringRegexp from 'escape-string-regexp'
import { genImport } from 'knitwork'

import { JS_ID_RE, VUE_NON_SCRIPT_BLOCK_RE, VUE_SCRIPT_ID_FILTER } from '../utils/index.ts'

type ImportPath = string

interface TreeShakeComposablesPluginOptions {
  composables: Record<ImportPath, string[]>
  /** Composables to replace with an argument-less call to the same export from the given module. */
  stubs?: Record<string, ImportPath>
}

export const TreeShakeComposablesPlugin = (options: TreeShakeComposablesPluginOptions) => createUnplugin(() => {
  // Create a fast lookup for all composable names
  const allComposableNames = new Set(Object.values(options.composables).flat())

  if (!allComposableNames.size) {
    return []
  }

  return {
    name: 'nuxt:tree-shake-composables:transform',
    enforce: 'post',
    transform: {
      filter: {
        id: {
          include: [...VUE_SCRIPT_ID_FILTER, JS_ID_RE],
          exclude: VUE_NON_SCRIPT_BLOCK_RE,
        },
        code: { include: new RegExp(`\\b(?:${[...allComposableNames].map(r => escapeStringRegexp(r)).join('|')})\\b`) },
      },
      handler (code, id, meta?: unknown) {
        const s = rolldownString(code, id, meta)
        const stubImports = new Map<string, string>()

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
            let composableName = functionName

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
              composableName = importedName

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

            const stub = options.stubs?.[composableName]
            if (stub) {
              const local = `__nuxt_stub_${composableName}`
              stubImports.set(local, genImport(stub, [{ name: composableName, as: local }]))
              s.overwrite(node.start, node.end, `${local}()`)
              this.skip()
              return
            }

            // TODO: validate function name against actual auto-imports registry
            s.overwrite(node.start, node.end, ` false && /*@__PURE__*/ ${functionName}${code.slice(node.callee.end, node.end)}`)
            this.skip()
          },
        })

        if (stubImports.size) {
          s.prepend([...stubImports.values(), ''].join('\n'))
        }

        return generateTransform(s, id)
      },
    },
  }
})
