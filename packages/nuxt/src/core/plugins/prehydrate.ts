import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { hash } from 'ohash'

import { parseAndWalk, transform, withLocations } from '../../core/utils/parse'
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
        const promises: Array<Promise<any>> = []

        parseAndWalk(code, id, (node) => {
          if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') {
            return
          }
          if (node.callee.name === 'onPrehydrate') {
            const callback = withLocations(node.arguments[0])
            if (!callback) { return }
            if (callback.type !== 'ArrowFunctionExpression' && callback.type !== 'FunctionExpression') { return }

            const needsAttr = callback.params.length > 0

            const p = transform(`forEach(${code.slice(callback.start, callback.end)})`, { loader: 'ts', minify: true })
            promises.push(p.then(({ code: result }) => {
              const cleaned = result.slice('forEach'.length).replace(/;\s+$/, '')
              const args = [JSON.stringify(cleaned)]
              if (needsAttr) {
                args.push(JSON.stringify(hash(result).slice(0, 10)))
              }
              s.overwrite(callback.start, callback.end, args.join(', '))
            }))
          }
        })

        await Promise.all(promises).catch((e) => {
          console.error(`[nuxt] Could not transform onPrehydrate in \`${id}\`:`, e)
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
