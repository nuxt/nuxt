import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import { ScopeTracker, walk } from 'oxc-walker'
import type { ESTree } from 'rolldown/utils'
import { VUE_SCRIPT_ID_FILTER } from '../utils/index.ts'
import { parseModule } from '../utils/parse.ts'

const NAVIGATE_TO_RE = /\bnavigateTo\s*\(/
const NAVIGATE_TO_SOURCES = new Set(['#app', '#imports', 'nuxt/app', '#app/composables', '#app/composables/router'])

const HELPER_SOURCE = '#app/composables/router'
const HELPER_NAME = '_navigateToEarlyReturn'
const HELPER_LOCAL = '__nuxt_navigate_to_early_return'

interface MatchedStatement {
  awaited: ESTree.AwaitExpression
  tempName: string
}

/**
 * Transforms top-level `await navigateTo(...)` statements in `<script setup>` into
 * early returns from `setup()`, so that code after a successful navigation does not run.
 *
 * The compiled setup function returns `_navigateToEarlyReturn()`, a render function that
 * renders a placeholder comment in both environments (see its definition for the SSR
 * mechanics) while the navigation proceeds.
 *
 * Runs with `enforce: 'post'`, after the auto-import transform, so that an explicit or
 * injected import of a user-defined `navigateTo` override is visible and skipped.
 */
export const NavigateToEarlyReturnPlugin = () => createUnplugin(() => {
  return {
    name: 'nuxt:navigate-to-early-return',
    enforce: 'post',
    transform: {
      filter: {
        id: {
          include: VUE_SCRIPT_ID_FILTER,
          exclude: /node_modules\//,
        },
        code: { include: /withAsyncContext/ },
      },
      handler (code, id, meta?: unknown) {
        if (!NAVIGATE_TO_RE.test(code)) { return }

        const { program } = parseModule(code, id)

        const scopeTracker = new ScopeTracker({ preserveExitedScopes: true })
        walk(program, { scopeTracker })
        scopeTracker.freeze()

        const s = rolldownString(code, id, meta)

        const setupFns = new Set<ESTree.Node>()
        const functionStack: ESTree.Node[] = []
        let transformed = false

        walk(program, {
          scopeTracker,
          enter (node, parent) {
            if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
              // only consider `setup` methods on objects at module scope, so that a `setup`
              // property on an object created inside another function is never matched
              if (functionStack.length === 0 && parent?.type === 'Property' && !parent.computed && parent.key.type === 'Identifier' && parent.key.name === 'setup') {
                setupFns.add(node)
              }
              functionStack.push(node)
              return
            }

            const enclosingFn = functionStack[functionStack.length - 1]
            if (node.type !== 'ExpressionStatement' || !enclosingFn || !setupFns.has(enclosingFn)) { return }

            const match = matchAwaitedNavigateTo(node)
            if (!match) { return }

            const declaration = scopeTracker.getDeclaration('navigateTo')
            if (declaration && (declaration.type !== 'Import' || typeof declaration.importNode.source.value !== 'string' || !NAVIGATE_TO_SOURCES.has(declaration.importNode.source.value))) {
              return
            }

            // wrap in a block so an `else` attached to an enclosing unbraced `if`
            // does not rebind to the `if` statement we generate here
            s.appendLeft(node.start, '{ if ((')
            s.appendLeft(match.awaited.start, `${match.tempName} = `)
            const end = code[node.end - 1] === ';' ? node.end - 1 : node.end
            s.appendLeft(end, `, ${match.tempName}) === undefined) return ${HELPER_LOCAL}()`)
            s.appendLeft(node.end, ' }')
            transformed = true
          },
          leave (node) {
            if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
              functionStack.pop()
            }
          },
        })

        if (transformed) {
          s.prepend(`import { ${HELPER_NAME} as ${HELPER_LOCAL} } from '${HELPER_SOURCE}';\n`)
        }

        return generateTransform(s, id)
      },
    },
  }
})

/**
 * Matches the statement shape `@vue/compiler-sfc` produces for a bare top-level
 * `await navigateTo(...)` in `<script setup>`:
 *
 * ```js
 * ;(
 *   ([__temp,__restore] = _withAsyncContext(() => navigateTo('/'))),
 *   await __temp,
 *   __restore()
 * )
 * ```
 */
function unwrapParens (node: ESTree.Expression): ESTree.Expression {
  while (node.type === 'ParenthesizedExpression') {
    node = node.expression
  }
  return node
}

function matchAwaitedNavigateTo (statement: ESTree.ExpressionStatement): MatchedStatement | undefined {
  const expression = unwrapParens(statement.expression)
  if (expression.type !== 'SequenceExpression' || expression.expressions.length < 3) { return }

  const assignment = unwrapParens(expression.expressions[0]!)
  const awaited = unwrapParens(expression.expressions[1]!)

  if (
    assignment.type !== 'AssignmentExpression'
    || assignment.right.type !== 'CallExpression'
    || assignment.right.callee.type !== 'Identifier'
    || !assignment.right.callee.name.endsWith('withAsyncContext')
  ) { return }

  const wrapped = assignment.right.arguments[0]
  if (wrapped?.type !== 'ArrowFunctionExpression' || wrapped.body.type === 'BlockStatement') { return }

  const call = unwrapParens(wrapped.body)
  if (call.type !== 'CallExpression' || call.callee.type !== 'Identifier' || call.callee.name !== 'navigateTo') { return }

  // `navigateTo` with `open` targets a new window, so the current component must keep rendering.
  // Skip the transform unless we can statically rule that (and other unknown option shapes) out.
  const options = call.arguments[1]
  if (options) {
    if (options.type !== 'ObjectExpression') { return }
    for (const property of options.properties) {
      if (property.type !== 'Property' || property.computed) { return }
      const name = property.key.type === 'Identifier' ? property.key.name : property.key.type === 'Literal' ? String(property.key.value) : undefined
      if (!name || name === 'open') { return }
    }
  }

  if (awaited.type !== 'AwaitExpression' || awaited.argument.type !== 'Identifier') { return }

  return { awaited, tempName: awaited.argument.name }
}
