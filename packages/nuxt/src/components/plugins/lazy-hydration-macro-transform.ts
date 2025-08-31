import { createUnplugin } from 'unplugin'
import { relative, resolve } from 'pathe'
import MagicString from 'magic-string'
import { genImport } from 'knitwork'
import { isJS, isVue } from '../../core/utils'
import type { ComponentsOptions } from 'nuxt/schema'
import { parseAndWalk } from 'oxc-walker'
import type { Expression, ImportExpression, StringLiteral } from 'oxc-parser'

interface LoaderOptions {
  srcDir: string
  sourcemap?: boolean
  transform?: ComponentsOptions['transform']
  clientDelayedComponentRuntime: string
  alias: Record<string, string>
}

const LAZY_HYDRATION_MACRO_RE = /\bdefineLazyHydrationComponent\s*\(/

const HYDRATION_TO_FACTORY = new Map<string, string>([
  ['visible', 'createLazyVisibleComponent'],
  ['idle', 'createLazyIdleComponent'],
  ['interaction', 'createLazyInteractionComponent'],
  ['mediaQuery', 'createLazyMediaQueryComponent'],
  ['if', 'createLazyIfComponent'],
  ['time', 'createLazyTimeComponent'],
  ['never', 'createLazyNeverComponent'],
])

export const LazyHydrationMacroTransformPlugin = (options: LoaderOptions) => createUnplugin(() => {
  const exclude = options.transform?.exclude || []
  const include = options.transform?.include || []

  const aliases = Object.entries(options.alias || {}).sort((a, b) => b[0].length - a[0].length)

  return {
    name: 'nuxt:lazy-hydration-macro',
    enforce: 'post',
    transformInclude (id) {
      if (exclude.some(pattern => pattern.test(id))) {
        return false
      }
      if (include.some(pattern => pattern.test(id))) {
        return true
      }
      return isVue(id, { type: ['template', 'script'] }) || isJS(id)
    },

    transform: {
      filter: {
        code: {
          include: LAZY_HYDRATION_MACRO_RE,
        },
      },
      handler (code, id) {
        const s = new MagicString(code)
        const names = new Set<string>()
        type Edit = { start: number, end: number, replacement: string }
        const edits: Edit[] = []

        parseAndWalk(code, id, (node, parent) => {
          if (node.type !== 'CallExpression') { return }
          if (node.callee?.type !== 'Identifier') { return }
          if (node.callee.name !== 'defineLazyHydrationComponent') { return }

          if (parent?.type !== 'VariableDeclarator') { return }
          if (parent.id.type !== 'Identifier') { return }

          if (node.arguments.length < 2) { return }
          const [strategyArgument, loaderArgument] = node.arguments

          if (!isStringLiteral(strategyArgument)) { return }
          const strategy: string = strategyArgument.value

          const functionName = HYDRATION_TO_FACTORY.get(strategy)
          if (!functionName) { return }

          if (loaderArgument?.type !== 'ArrowFunctionExpression') { return }
          if (loaderArgument.body.type === 'BlockStatement') { return }

          let importExpression: ImportExpression | null = null
          let importLiteral: Expression | null = null

          if (loaderArgument.body.type === 'ImportExpression') {
            importExpression = loaderArgument.body
            importLiteral = loaderArgument.body.source
          } else if (
            loaderArgument.body.type === 'CallExpression' &&
              loaderArgument.body.callee.type === 'MemberExpression' &&
              loaderArgument.body.callee.object.type === 'ImportExpression'
          ) {
            importExpression = loaderArgument.body.callee.object
            importLiteral = importExpression.source
          } else {
            return
          }

          if (!isStringLiteral(importLiteral)) { return }

          const rawPath = importLiteral.value
          const filePath = resolveAliases(aliases, rawPath)
          const relativePath = relative(options.srcDir, filePath)

          const originalLoader = code.slice(loaderArgument.start, loaderArgument.end)
          const replacement = `__${functionName}(${JSON.stringify(relativePath)}, ${originalLoader})`

          edits.push({ start: node.start, end: node.end, replacement })
          names.add(functionName)
        })

        for (const edit of edits) {
          s.overwrite(edit.start, edit.end, edit.replacement)
        }

        if (names.size) {
          const imports = genImport(options.clientDelayedComponentRuntime, [...names].map(name => ({ name, as: `__${name}` })))
          s.prepend(imports)
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

function isStringLiteral (node: any): node is StringLiteral {
  return !!node && node.type === 'Literal' && typeof node.value === 'string'
}

function resolveAliases (aliases: [string, string][], filePath: string) {
  for (const [alias, target] of aliases) {
    if (!filePath.startsWith(alias)) { continue }
    const rest = filePath.slice(alias.length).replace(/^[/\\]+/, '')
    return resolve(target, rest)
  }

  return filePath
}
