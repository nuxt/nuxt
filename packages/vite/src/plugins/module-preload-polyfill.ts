import MagicString from 'magic-string'
import type { Plugin } from 'vite'

const QUERY_RE = /\?.+$/

export function ModulePreloadPolyfillPlugin (options: { sourcemap: boolean, entry: string }): Plugin {
  let isDisabled = false
  return {
    name: 'nuxt:module-preload-polyfill',
    configResolved (config) {
      isDisabled = config.build.modulePreload === false || config.build.modulePreload.polyfill === false
    },
    transform (code, id) {
      if (isDisabled || id.replace(QUERY_RE, '') !== options.entry) { return }

      const s = new MagicString(code)

      s.prepend('import "vite/modulepreload-polyfill";\n')

      return {
        code: s.toString(),
        map: options.sourcemap ? s.generateMap({ hires: true }) : undefined,
      }
    },
  }
}
