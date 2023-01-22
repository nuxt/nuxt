import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import { isAbsolute, relative } from 'pathe'
import type { Node } from 'estree-walker'
import { walk } from 'estree-walker'
import MagicString from 'magic-string'
import { hash } from 'ohash'
import type { CallExpression } from 'estree'
import { parseQuery, parseURL } from 'ufo'

export interface ComposableKeysOptions {
  sourcemap: boolean
  rootDir: string
}

const keyedFunctions = [
  'useState', 'useFetch', 'useAsyncData', 'useLazyAsyncData', 'useLazyFetch'
]
const KEYED_FUNCTIONS_RE = new RegExp(`(${keyedFunctions.join('|')})`)
const stringTypes = ['Literal', 'TemplateLiteral']

export const composableKeysPlugin = createUnplugin((options: ComposableKeysOptions) => {
  return {
    name: 'nuxt:composable-keys',
    enforce: 'post',
    transformInclude (id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      return !pathname.match(/node_modules\/nuxt3?\//) && pathname.match(/\.(m?[jt]sx?|vue)/) && parseQuery(search).type !== 'style' && !parseQuery(search).macro
    },
    transform (code, id) {
      if (!KEYED_FUNCTIONS_RE.test(code)) { return }
      const { 0: script = code, index: codeIndex = 0 } = code.match(/(?<=<script[^>]*>)[\S\s.]*?(?=<\/script>)/) || { index: 0, 0: code }
      const s = new MagicString(code)
      // https://github.com/unjs/unplugin/issues/90
      let count = 0
      const relativeID = isAbsolute(id) ? relative(options.rootDir, id) : id
      walk(this.parse(script, {
        sourceType: 'module',
        ecmaVersion: 'latest'
      }) as Node, {
        enter (_node) {
          if (_node.type !== 'CallExpression' || (_node as CallExpression).callee.type !== 'Identifier') { return }
          const node: CallExpression = _node as CallExpression
          const name = 'name' in node.callee && node.callee.name
          if (!name || !keyedFunctions.includes(name) || node.arguments.length >= 4) { return }

          switch (name) {
            case 'useState':
              if (node.arguments.length >= 2 || stringTypes.includes(node.arguments[0]?.type)) { return }
              break

            case 'useFetch':
            case 'useLazyFetch':
              if (node.arguments.length >= 3 || stringTypes.includes(node.arguments[1]?.type)) { return }
              break

            case 'useAsyncData':
            case 'useLazyAsyncData':
              if (node.arguments.length >= 3 || stringTypes.includes(node.arguments[0]?.type) || stringTypes.includes(node.arguments[node.arguments.length - 1]?.type)) { return }
              break
          }

          // TODO: Optimize me (https://github.com/nuxt/framework/pull/8529)
          const endsWithComma = code.slice(codeIndex + (node as any).start, codeIndex + (node as any).end - 1).trim().endsWith(',')

          s.appendLeft(
            codeIndex + (node as any).end - 1,
            (node.arguments.length && !endsWithComma ? ', ' : '') + "'$" + hash(`${relativeID}-${++count}`) + "'"
          )
        }
      })
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap
            ? s.generateMap({ source: id, includeContent: true })
            : undefined
        }
      }
    }
  }
})
