import { pathToFileURL } from 'node:url'
import { stripLiteral } from 'strip-literal'
import { parseQuery, parseURL } from 'ufo'
import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'
import type { ImportsTreeShakeCtx } from 'nuxt/schema'

export type TreeShakeOptions = ImportsTreeShakeCtx[keyof ImportsTreeShakeCtx]

export function normaliseTreeShakeOptions (options: TreeShakeOptions) {
  // only set a matcher if we have functions to tree shake
  if (!options.treeShake.size) {
    return options
  }
  options.matcher = new RegExp(`($\\s+)(${[...options.treeShake].join('|')})(?=\\()`, 'gm')
  return options
}

export const TreeShakePlugin = createUnplugin((options: ImportsTreeShakeCtx[keyof ImportsTreeShakeCtx]) => {
  return {
    name: 'nuxt:tree-shake:transform',
    enforce: 'post',
    transformInclude (id) {
      if (!options.matcher) { return false }
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
      if (!options.matcher) { return }
      if (!code.match(options.matcher)) { return }

      const s = new MagicString(code)
      const strippedCode = stripLiteral(code)
      for (const match of strippedCode.matchAll(options.matcher) || []) {
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
