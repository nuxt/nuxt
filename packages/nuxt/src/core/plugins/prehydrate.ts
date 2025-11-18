import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { hash } from 'ohash'

import { parseAndWalk } from 'oxc-walker'
import { transformAndMinify } from '../../core/utils/parse'
import { isJS, isVue } from '../utils'

export function PrehydrateTransformPlugin (options: { sourcemap?: boolean } = {}) {
  return createUnplugin(() => ({
    name: 'nuxt:prehydrate-transform',
    transformInclude (id) {
      return isJS(id) || isVue(id, { type: ['script'] })
    },
    transform: {
      filter: {
        code: { include: /onPrehydrate\(/ },
      },
      async handler (code, id) {
        const s = new MagicString(code)

        parseAndWalk(code, id, (node) => {
          if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') {
            return
          }
          if (node.callee.name === 'onPrehydrate') {
            const callback = node.arguments[0]
            if (!callback) { return }
            if (callback.type !== 'ArrowFunctionExpression' && callback.type !== 'FunctionExpression') { return }

            const needsAttr = callback.params.length > 0
            const { code: result } = transformAndMinify(`forEach(${code.slice(callback.start, callback.end)})`, { lang: 'ts' })
            const cleaned = result.slice('forEach'.length).replace(/;$/, '')
            const args = [JSON.stringify(cleaned)]
            if (needsAttr) {
              args.push(JSON.stringify(hash(result).slice(0, 10)))
            }
            s.overwrite(callback.start, callback.end, args.join(', '))
          }
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
  }))
}
