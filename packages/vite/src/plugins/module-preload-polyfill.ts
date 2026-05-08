import MagicString from 'magic-string'
import type { Plugin } from 'vite'
import { resolveClientEntry } from '../utils/config.ts'

const QUERY_RE = /\?.+$/

export function ModulePreloadPolyfillPlugin (): Plugin {
  let isDisabled = false
  let entry: string
  let sourcemap: boolean
  return {
    name: 'nuxt:module-preload-polyfill',
    applyToEnvironment: environment => environment.name === 'client',
    configResolved (config) {
      try {
        isDisabled = config.build.modulePreload === false || config.build.modulePreload.polyfill === false
        sourcemap = !!config.build.sourcemap
        entry = resolveClientEntry(config)
      } catch {
        console.debug('[nuxt:module-preload-polyfill] Could not resolve client entry, module preload polyfill will not be injected.')
      }
    },
    transform (code, id) {
      if (isDisabled || id.replace(QUERY_RE, '') !== entry) { return }

      const s = new MagicString(code)

      s.prepend('import "vite/modulepreload-polyfill";\n')

      return {
        code: s.toString(),
        map: sourcemap ? s.generateMap({ hires: true }) : undefined,
      }
    },
  }
}
