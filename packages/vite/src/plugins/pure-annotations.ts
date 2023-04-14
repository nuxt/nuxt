import { pathToFileURL } from 'node:url'
import MagicString from 'magic-string'
import { parseQuery, parseURL } from 'ufo'
import { createUnplugin } from 'unplugin'
import { stripLiteral } from 'strip-literal'

export interface PureAnnotationsOptions {
  sourcemap: boolean
  functions: string[]
}

export const pureAnnotationsPlugin = createUnplugin((options: PureAnnotationsOptions) => {
  const FUNCTION_RE = new RegExp(`(?<!\\/\\* #__PURE__ \\*\\/ )\\b(${options.functions.join('|')})\\s*\\(`, 'g')
  const FUNCTION_RE_SINGLE = new RegExp(`(?<!\\/\\* #__PURE__ \\*\\/ )\\b(${options.functions.join('|')})\\s*\\(`)
  return {
    name: 'nuxt:pure-annotations',
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
    transform (code) {
      if (!FUNCTION_RE_SINGLE.test(code)) { return }

      const s = new MagicString(code)
      const strippedCode = stripLiteral(code)

      for (const match of strippedCode.matchAll(FUNCTION_RE)) {
        s.overwrite(match.index!, match.index! + match[0].length, '/* #__PURE__ */ ' + match[0])
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap
            ? s.generateMap({ hires: true })
            : undefined
        }
      }
    }
  }
})
