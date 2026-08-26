import { generateTransform, rolldownString } from 'rolldown-string'
import { type Nuxt, shouldEnableTypeCheck } from '@nuxt/schema'
import type { Plugin } from 'vite'
import { resolveClientEntry } from '../utils/config.ts'

const QUERY_RE = /\?.+$/

export function TypeCheckPlugin (nuxt: Nuxt): Plugin {
  let entry: string
  return {
    name: 'nuxt:type-check',
    applyToEnvironment: environment => environment.name === 'client' && !environment.config.isProduction,
    apply: () => {
      return shouldEnableTypeCheck(nuxt.options.typescript.typeCheck, { dev: true, test: nuxt.options.test })
    },
    configResolved (config) {
      try {
        entry = resolveClientEntry(config)
      } catch {
        console.debug('[nuxt:type-check] Could not resolve client entry, type checking will not be applied.')
      }
    },
    transform (code, id, meta?: unknown) {
      if (id.replace(QUERY_RE, '') !== entry) { return }

      const s = rolldownString(code, id, meta)

      s.prepend('import "/@vite-plugin-checker-runtime-entry";\n')

      return generateTransform(s, id)
    },
  }
}
