import MagicString from 'magic-string'
import type { Plugin } from 'vite'

export function typeCheckPlugin (): Plugin {
  let entry: string
  return {
    name: 'nuxt:type-check',
    configResolved (config) {
      const input = config.build.rollupOptions.input
      console.log(input)
      if (input && typeof input !== 'string' && !Array.isArray(input)) {
        entry = input.entry
      }
    },
    transform (code, id) {
      if (id !== entry) { return }

      const s = new MagicString(code)

      s.prepend('import "/@vite-plugin-checker-runtime-entry";\n')

      return s.toString()
    }
  }
}
