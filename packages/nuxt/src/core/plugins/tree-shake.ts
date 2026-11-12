import { generateTransform, rolldownString } from 'rolldown-string'
import { createUnplugin } from 'unplugin'
import { ScopeTracker, parseAndWalk, walk } from 'oxc-walker'
import escapeStringRegexp from 'escape-string-regexp'
import { genImport } from 'knitwork'

import { JS_ID_RE, VUE_NON_SCRIPT_BLOCK_RE, VUE_SCRIPT_ID_FILTER } from '../utils/index.ts'

type ImportPath = string

interface TreeShakeComposablesPluginOptions {
  composables: Record<ImportPath, string[]>
  /** Composables to replace with a call to the same export from the given module, without the first argument. */
  stubs?: Record<string, ImportPath>
  /** Auto-imports keyed by local name, so auto-imports from a subpath of a configured import path are tree-shaken too. */
  getAutoImports?: () => Promise<Map<string, { name: string, from: string }>> | undefined
}

export const TreeShakeComposablesPlugin = (options: TreeShakeComposablesPluginOptions) => createUnplugin(() => {
  // Create a fast lookup for all composable names
  const allComposableNames = new Set(Object.values(options.composables).flat())

  if (!allComposableNames.size) {
    return []
  }

  function isAllowedImport (importPath: string, importedName: string, autoImports?: Map<string, { name: string, from: string }>) {
    if (importPath === '#imports') {
      return allComposableNames.has(importedName)
    }
    if (options.composables[importPath]?.includes(importedName)) {
      return true
    }
    const autoImport = autoImports?.get(importedName)
    if (autoImport?.name !== importedName || autoImport.from !== importPath) {
      return false
    }
    for (const path in options.composables) {
      if (importPath.startsWith(path + '/') && options.composables[path]!.includes(importedName)) {
        return true
      }
    }
    return false
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
      async handler (code, id, meta?: unknown) {
        const autoImports = await options.getAutoImports?.()
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

              if (!isAllowedImport(importPath, importedName, autoImports)) {
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
              const rest = node.arguments.slice(1)
              const args = rest.length ? code.slice(rest[0]!.start, rest.at(-1)!.end) : ''
              s.overwrite(node.start, node.end, `${local}(${args})`)
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
