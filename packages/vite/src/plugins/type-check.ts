import MagicString from 'magic-string'
import type { Plugin } from 'vite'

export function typeCheckPlugin (): Plugin {
  return {
    name: 'nuxt:type-check',
    transform (code, id) {
      if (!id.includes('entry.ts')) { return }

      const s = new MagicString(code)

      s.prepend('import "/@vite-plugin-checker-runtime-entry";\n')

      return s.toString()
    }
  }
}
