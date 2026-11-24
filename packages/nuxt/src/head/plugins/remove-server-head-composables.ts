import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import { ScopeTracker, ScopeTrackerImport, parseAndWalk, walk } from 'oxc-walker'
import { JS_ID_RE, VUE_NON_SCRIPT_BLOCK_RE, VUE_SCRIPT_ID_FILTER } from '../../core/utils/index.ts'

const SERVER_HEAD_COMPOSABLES = new Set(['useServerHead', 'useServerHeadSafe', 'useServerSeoMeta'])
const HEAD_IMPORT_SOURCES = new Set(['#app', '#app/composables', '#app/composables/head', 'nuxt/app', 'nuxt/app/composables', 'nuxt/app/composables/head'])

export const RemoveServerHeadComposablesPlugin = () => createUnplugin(() => ({
  name: 'nuxt:head:remove-server-composables',
  enforce: 'post',
  transform: {
    filter: {
      id: {
        include: [...VUE_SCRIPT_ID_FILTER, JS_ID_RE],
        exclude: [VUE_NON_SCRIPT_BLOCK_RE],
      },
      code: { include: /\b(?:useServerHead|useServerHeadSafe|useServerSeoMeta)\b/ },
    },
    handler (code, id, meta?: unknown) {
      const scopeTracker = new ScopeTracker({ preserveExitedScopes: true })
      const ast = parseAndWalk(code, id, { scopeTracker })
      scopeTracker.freeze()
      const s = rolldownString(code, id, meta)
      walk(ast.program, {
        scopeTracker,
        enter (node, parent) {
          // Removing a call whose returned entry is used would break callers, so only drop standalone statements.
          if (parent?.type !== 'ExpressionStatement' || node.type !== 'CallExpression' || node.callee.type !== 'Identifier') {
            return
          }
          const declaration = scopeTracker.getDeclaration(node.callee.name)
          if (!(declaration instanceof ScopeTrackerImport)) {
            return
          }
          if (
            declaration.node.type === 'ImportSpecifier'
            && declaration.node.imported.type === 'Identifier'
            && SERVER_HEAD_COMPOSABLES.has(declaration.node.imported.name)
            && HEAD_IMPORT_SOURCES.has(declaration.importNode.source.value)
          ) {
            s.overwrite(parent.start, parent.end, ';')
            this.skip()
          }
        },
      })
      return generateTransform(s, id)
    },
  },
}))
