import { pathToFileURL } from 'node:url'
import { stripLiteral } from 'strip-literal'
import { parseQuery, parseURL } from 'ufo'
import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'

type ImportPath = string

export interface TreeShakeComposablesPluginOptions {
  sourcemap?: boolean
  composables: Record<ImportPath, string[]>
}

export const TreeShakeComposablesPlugin = createUnplugin((options: TreeShakeComposablesPluginOptions) => {
  /**
   * @todo Use the options import-path to tree-shake composables in a safer way.
   */
  const composableNames = Object.values(options.composables).flat()
  const COMPOSABLE_RE = new RegExp(`($\\s+)(${composableNames.join('|')})(?=\\()`, 'gm')

  return {
    name: 'nuxt:tree-shake-composables:transform',
    enforce: 'post',
    transformInclude (id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      const { type } = parseQuery(search)

      // vue files
      if (pathname.endsWith('.vue') && (type === 'script' || !search)) {
        return true
      }

      // js files
      if (pathname.match(/\.((c|m)?j|t)sx?$/g)) {
        return true
      }
    },
    transform (code, id) {
      if (!code.match(COMPOSABLE_RE)) { return }

      const s = new MagicString(code)
      const strippedCode = stripLiteral(code)
      for (const match of strippedCode.matchAll(COMPOSABLE_RE) || []) {
        s.overwrite(match.index!, match.index! + match[0].length, `${match[1]} /*#__PURE__*/ false && ${match[2]}`)
      }

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
