import MagicString from 'magic-string'
import type { Plugin } from 'vite'

export function typeCheckPlugin (options: { sourcemap?: boolean } = {}): Plugin {
  let entry: string
  return {
    name: 'nuxt:type-check',
    configResolved (config) {
      const input = config.build.rollupOptions.input
      if (input && typeof input !== 'string' && !Array.isArray(input)) {
        entry = input.entry
      }
    },
    transform (code, id) {
      if (id !== entry) { return }

      const s = new MagicString(code)

      s.prepend('import "/@vite-plugin-checker-runtime-entry";\n')

      return {
        code: s.toString(),
        map: options.sourcemap ? s.generateMap({ hires: true }) : undefined
      }
    }
  }
}
