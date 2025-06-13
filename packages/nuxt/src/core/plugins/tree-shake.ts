import { stripLiteral } from 'strip-literal'
import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'
import { isJS, isVue } from '../utils'

type ImportPath = string

interface TreeShakeComposablesPluginOptions {
  sourcemap?: boolean
  composables: Record<ImportPath, string[]>
}

export const TreeShakeComposablesPlugin = (options: TreeShakeComposablesPluginOptions) => createUnplugin(() => {
  /**
   * @todo Use the options import-path to tree-shake composables in a safer way.
   */
  const composableNames = Object.values(options.composables).flat()

  const regexp = `(^\\s*)(${composableNames.join('|')})(?=\\((?!\\) \\{))`
  const COMPOSABLE_RE = new RegExp(regexp, 'm')
  const COMPOSABLE_RE_GLOBAL = new RegExp(regexp, 'gm')

  return {
    name: 'nuxt:tree-shake-composables:transform',
    enforce: 'post',
    transformInclude (id) {
      return isVue(id, { type: ['script'] }) || isJS(id)
    },
    transform: {
      filter: {
        code: { include: COMPOSABLE_RE },
      },
      handler (code) {
        const s = new MagicString(code)
        const strippedCode = stripLiteral(code)
        for (const match of strippedCode.matchAll(COMPOSABLE_RE_GLOBAL)) {
          s.overwrite(match.index!, match.index! + match[0].length, `${match[1]} false && /*@__PURE__*/ ${match[2]}`)
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
