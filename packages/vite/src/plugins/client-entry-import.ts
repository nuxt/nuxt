import { generateTransform, rolldownString } from 'rolldown-string'
import type { Plugin, ResolvedConfig } from 'vite'
import { resolveClientEntry } from '../utils/config.ts'

const QUERY_RE = /\?.+$/

/** Import `specifier` at the top of the client entry, when `isEnabled` is true for the resolved config. */
export function ClientEntryImportPlugin (name: string, specifier: string, isEnabled: (config: ResolvedConfig) => boolean = () => true): Plugin {
  let entry: string | undefined
  return {
    name,
    applyToEnvironment: environment => environment.name === 'client',
    configResolved (config) {
      try {
        entry = isEnabled(config) ? resolveClientEntry(config) : undefined
      } catch {
        console.debug(`[${name}] Could not resolve client entry, \`${specifier}\` will not be imported.`)
      }
    },
    transform (code, id, meta?: unknown) {
      if (!entry || id.replace(QUERY_RE, '') !== entry) { return }

      const s = rolldownString(code, id, meta)
      s.prepend(`import ${JSON.stringify(specifier)};\n`)
      return generateTransform(s, id)
    },
  }
}

export function ModulePreloadPolyfillPlugin (): Plugin {
  return ClientEntryImportPlugin('nuxt:module-preload-polyfill', 'vite/modulepreload-polyfill', config => config.build.modulePreload !== false && config.build.modulePreload.polyfill !== false)
}
