import { pathToFileURL } from 'node:url'
import { stripLiteral } from 'strip-literal'
import { parseQuery, parseURL } from 'ufo'
import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'

interface TreeShakePluginOptions {
  sourcemap?: boolean
  treeShake: string[]
}

export const TreeShakePlugin = createUnplugin((options: TreeShakePluginOptions) => {
  const COMPOSABLE_RE = new RegExp(`($|\\s*)(${options.treeShake.join('|')})(?=\\()`, 'g')

  return {
    name: 'nuxt:server-treeshake:transfrom',
    enforce: 'post',
    transformInclude (id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      const { type, macro } = parseQuery(search)

      // vue files
      if (pathname.endsWith('.vue') && (type === 'script' || macro || !search)) {
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
        s.overwrite(match.index, match.index + match[0].length, `(() => {}) || /*#__PURE__*/ false && ${match[0]}`)
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap && s.generateMap({ source: id, includeContent: true })
        }
      }
    }
  }
})
