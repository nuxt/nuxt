import MagicString from 'magic-string'
import type { Nuxt } from '@nuxt/schema'
import type { Plugin } from 'vite'
import { resolveClientEntry } from '../utils/config'

const QUERY_RE = /\?.+$/

export function TypeCheckPlugin (nuxt: Nuxt): Plugin {
  let entry: string
  let sourcemap: boolean
  return {
    name: 'nuxt:type-check',
    applyToEnvironment: environment => environment.name === 'client' && !environment.config.isProduction,
    apply: () => {
      return !nuxt.options.test && nuxt.options.typescript.typeCheck === true
    },
    configResolved (config) {
      entry = resolveClientEntry(config)
      sourcemap = !!config.build.sourcemap
    },
    transform (code, id) {
      if (id.replace(QUERY_RE, '') !== entry) { return }

      const s = new MagicString(code)

      s.prepend('import "/@vite-plugin-checker-runtime-entry";\n')

      return {
        code: s.toString(),
        map: sourcemap ? s.generateMap({ hires: true }) : undefined,
      }
    },
  }
}
