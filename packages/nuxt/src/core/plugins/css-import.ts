import { genImport } from 'knitwork'
import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'

interface CSSPluginOptions {
  sourcemap?: boolean
  rootId: () => string
  css: string[]
}

const SCRIPT_RE = /<script[^>]*>/i

export const CSSPlugin = (options: CSSPluginOptions) => createUnplugin(() => {
  return {
    name: 'nuxt:css-import:transform',
    enforce: 'pre',
    transformInclude (id) {
      return id === options.rootId()
    },
    transform (code) {
      const s = new MagicString(code)
      s.replace(SCRIPT_RE, ['$0', ...options.css.map(i => genImport(i))].join('\n'))

      return {
        code: s.toString(),
        map: options.sourcemap
          ? s.generateMap({ hires: true })
          : undefined
      }
    }
  }
})
