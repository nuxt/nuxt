import MagicString from 'magic-string'
import type { Plugin } from 'vite'

const QUERY_RE = /\?.+$/

export function ModulePreloadPolyfillPlugin (options: { sourcemap: boolean, entry: string }): Plugin {
  return {
    name: 'nuxt:module-preload-polyfill',
    transform (code, id) {
      if (id.replace(QUERY_RE, '') !== options.entry) { return }

      const s = new MagicString(code)

      s.prepend('import "vite/modulepreload-polyfill";\n')

      return {
        code: s.toString(),
        map: options.sourcemap ? s.generateMap({ hires: true }) : undefined,
      }
    },
  }
}
