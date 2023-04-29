import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'
import { stripLiteral } from 'strip-literal'
import { isJS, isVue } from '../../../nuxt/src/core/utils/plugins'

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
      return isVue(id, { type: ['script'] }) || isJS(id)
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
