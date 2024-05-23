import { transform } from 'esbuild'
import { parse } from 'acorn'
import { walk } from 'estree-walker'
import type { Node } from 'estree-walker'
import type { Nuxt } from '@nuxt/schema'
import { createUnplugin } from 'unplugin'
import type { SimpleCallExpression } from 'estree'
import MagicString from 'magic-string'

import { hash } from 'ohash'
import { isJS, isVue } from '../utils'

export function prehydrateTransformPlugin (nuxt: Nuxt) {
  return createUnplugin(() => ({
    name: 'nuxt:prehydrate-transform',
    transformInclude (id) {
      return isJS(id) || isVue(id, { type: ['script'] })
    },
    async transform (code, id) {
      if (!code.includes('onPrehydrate(')) { return }

      const s = new MagicString(code)
      const promises: Array<Promise<any>> = []

      walk(parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        ranges: true,
      }) as Node, {
        enter (_node) {
          if (_node.type !== 'CallExpression' || _node.callee.type !== 'Identifier') { return }
          const node = _node as SimpleCallExpression & { start: number, end: number }
          const name = 'name' in node.callee && node.callee.name
          if (name === 'onPrehydrate') {
            if (node.arguments[0].type !== 'ArrowFunctionExpression' && node.arguments[0].type !== 'FunctionExpression') { return }

            const needsAttr = node.arguments[0].params.length > 0
            const { start, end } = node.arguments[0] as Node & { start: number, end: number }

            const p = transform(`forEach(${code.slice(start, end)})`, { loader: 'ts', minify: true })
            promises.push(p.then(({ code: result }) => {
              const cleaned = result.slice('forEach'.length).replace(/;\s+$/, '')
              const args = [JSON.stringify(cleaned)]
              if (needsAttr) {
                args.push(JSON.stringify(hash(result)))
              }
              s.overwrite(start, end, args.join(', '))
            }))
          }
        },
      })

      await Promise.all(promises).catch((e) => {
        console.error(`[nuxt] Could not transform onPrehydrate in \`${id}\`:`, e)
      })

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: nuxt.options.sourcemap.server || nuxt.options.sourcemap.client
            ? s.generateMap({ hires: true })
            : undefined,
        }
      }
    },
  }))
}
