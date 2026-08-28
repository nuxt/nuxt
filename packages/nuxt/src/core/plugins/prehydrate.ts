import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import { hash } from 'ohash'

import { parseAndWalk } from 'oxc-walker'
import { transformAndMinify } from '../../core/utils/parse.ts'
import { JS_ID_RE, VUE_NON_SCRIPT_BLOCK_RE, VUE_SCRIPT_ID_FILTER } from '../utils/index.ts'

export function PrehydrateTransformPlugin () {
  return createUnplugin(() => ({
    name: 'nuxt:prehydrate-transform',
    transform: {
      filter: {
        id: {
          include: [...VUE_SCRIPT_ID_FILTER, JS_ID_RE],
          exclude: VUE_NON_SCRIPT_BLOCK_RE,
        },
        code: { include: /onPrehydrate\(/ },
      },
      handler (code, id, meta?: unknown) {
        const s = rolldownString(code, id, meta)

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

        return generateTransform(s, id)
      },
    },
  }))
}
